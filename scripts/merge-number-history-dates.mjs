// Merge extra dates from the live archive into the offline number-history
// database, without touching anything already stored.
// Run: node scripts/merge-number-history-dates.mjs 2022-04-21 2022-07-13
import fs from "node:fs";

const DB_FILE = "src/components/sites/live4dresult-net-0600c55d/root-8a5edab2/number-history-db.json";
const FROM = process.argv[2];
const TO = process.argv[3];
if (!FROM || !TO) throw new Error("usage: node scripts/merge-number-history-dates.mjs <fromIso> <toIso>");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const DAY0 = Date.UTC(2020, 0, 1);
const epochDay = (iso) => Math.round((Date.parse(iso + "T00:00:00Z") - DAY0) / 86400000);

const CATS = { "1st": 0, "2nd": 1, "3rd": 2, Special: 3, Consolation: 4 };
// "1st Prize 首獎" on most games, plain "1st 首獎" on SportsToto.
const CAT_RE = /^\s*(1st|2nd|3rd)(?:\s*Prize)?\b|^\s*(Special|Consolation)/i;
const clean = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();

function parseCard(seg) {
  const name = clean((seg.match(/lottery-name[^>]*>([\s\S]*?)<\/div>/) || [])[1]);
  const logo = (seg.match(/lottery-logo[^>]*>\s*<img[^>]*src="([^"]+)"/) || [])[1] || "";
  const tableId = (seg.match(/class="card outer-box (table-[0-9][^"]*)"/) || [])[1] || "";
  const dateLbl = ((seg.match(/data-id="date">([^<]*)</) || [])[1] || "").trim();
  const dm = /^(\d{2})-(\d{2})-(\d{4})/.exec(dateLbl);
  const dateIso = dm ? dm[3] + "-" + dm[2] + "-" + dm[1] : "";
  const numbers = [];
  let cat = null;
  for (const m of seg.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)) {
    const txt = clean(m[1]);
    const lm = CAT_RE.exec(txt);
    if (lm) {
      const k = (lm[1] || lm[2] || "").toLowerCase();
      if (k === "1st" || k === "2nd" || k === "3rd") cat = k;
      else if (k.startsWith("special")) cat = "Special";
      else if (k.startsWith("consolation")) cat = "Consolation";
      continue;
    }
    const v = txt.replace(/\s+/g, "");
    if (/^\d{4}$/.test(v) && cat) numbers.push({ num: v, cat: CATS[cat] });
  }
  return { name, logo, tableId, dateIso, numbers };
}

const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
const gameIdx = new Map(db.games.map((g, i) => [g.name, i]));
const have = new Set();
for (const num of Object.keys(db.hits)) for (const [dd, g, c] of db.hits[num]) have.add(num + "|" + dd + "|" + g + "|" + c);

const dates = [];
for (let t = Date.parse(FROM + "T00:00:00Z"); t <= Date.parse(TO + "T00:00:00Z"); t += 86400000) {
  dates.push(new Date(t).toISOString().slice(0, 10));
}

let pages = 0, empty = 0, added = 0, skipped = 0;
let idx = 0;
async function worker() {
  while (idx < dates.length) {
    const d = dates[idx++];
    let html = "";
    try {
      const r = await fetch("https://live4dresult.net/past-results/" + d, { headers: { "User-Agent": UA, Accept: "*/*" }, signal: AbortSignal.timeout(30000) });
      if (r.ok) html = await r.text();
    } catch { /* fall through to the empty check */ }
    if (!html || !/card outer-box table-/.test(html)) { empty++; continue; }
    pages++;
    const starts = [];
    const re = /class="card outer-box (table-[0-9][^"]*)"/g;
    let m;
    while ((m = re.exec(html))) starts.push(m.index);
    for (let k = 0; k < starts.length; k++) {
      const seg = html.slice(starts[k], k + 1 < starts.length ? starts[k + 1] : html.length);
      const card = parseCard(seg);
      if (!card.name || !card.tableId) continue;
      if (card.dateIso && card.dateIso !== d) { skipped++; continue; }
      let gi = gameIdx.get(card.name);
      if (gi === undefined) {
        gi = db.games.length;
        db.games.push({ name: card.name, logo: card.logo, table: card.tableId });
        gameIdx.set(card.name, gi);
      }
      const dd = epochDay(d) - db.dayBase;
      for (const n of card.numbers) {
        const key = n.num + "|" + dd + "|" + gi + "|" + n.cat;
        if (have.has(key)) continue;
        have.add(key);
        if (!db.hits[n.num]) db.hits[n.num] = [];
        db.hits[n.num].push([dd, gi, n.cat]);
        added++;
      }
    }
  }
}

await Promise.all(Array.from({ length: 8 }, () => worker()));

db.meta.built = new Date().toISOString();
fs.writeFileSync(DB_FILE, JSON.stringify(db));
console.log("dates scanned      : " + dates.length + "  (" + FROM + " .. " + TO + ")");
console.log("pages with results : " + pages + "   empty pages: " + empty + "   wrong-date cards skipped: " + skipped);
console.log("new records added  : " + added);
console.log("DB size            : " + Math.round(fs.statSync(DB_FILE).size / 1024) + " KB   numbers indexed: " + Object.keys(db.hits).length);
