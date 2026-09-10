// Build the offline number-history database by scanning live4dresult.net's
// per-date past-result archive (which mirrors the results shown on this site).
// Run: node scripts/build-number-history.mjs [days]
import fs from "node:fs";
import path from "node:path";

const START_ARG = process.argv[2] || "2022-07-27";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const outFile = path.resolve("src/components/sites/live4dresult-net-0600c55d/root-8a5edab2/number-history-db.json");

function epochDay(iso) {
  return Math.round((Date.parse(iso + "T00:00:00Z") - Date.UTC(2020, 0, 1)) / 86400000);
}
function isoFromEpoch(d) {
  const dt = new Date(Date.UTC(2020, 0, 1) + d * 86400000);
  return dt.toISOString().slice(0, 10);
}
function fmtDate(iso) {
  const [y, m, d] = iso.split("-");
  const dt = new Date(iso + "T12:00:00");
  const wk = isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US", { weekday: "short" });
  return `${d}-${m}-${y} (${wk})`;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" }, signal: AbortSignal.timeout(25000) });
  if (!res.ok) return "";
  return await res.text();
}

const CATS = { "1st": 0, "2nd": 1, "3rd": 2, Special: 3, Consolation: 4 };
const CAT_RE = /^\s*(1st|2nd|3rd)\s*Prize|^\s*(Special|Consolation)/i;
function cleanTxt(s) {
  return (s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}
function innerText(html) {
  return cleanTxt(html.replace(/<td\b/g, "<td"));
}

function parseCard(seg) {
  const nameM = seg.match(/lottery-name[^>]*>([\s\S]*?)<\/div>/);
  const name = cleanTxt(nameM ? nameM[1] : "");
  const logoM = seg.match(/lottery-logo[^>]*>\s*<img[^>]*src="([^"]+)"/);
  const logo = logoM ? logoM[1].replace(/^\/wp-content/, "/wp-content") : "";
  const dateM = seg.match(/data-id="date">([^<]*)</);
  const dateLbl = dateM ? dateM[1].trim() : "";
  const dm = /^(\d{2})-(\d{2})-(\d{4})/.exec(dateLbl);
  const dateIso = dm ? dm[3] + "-" + dm[2] + "-" + dm[1] : "";
  const tableM = seg.match(/class="card outer-box (table-[0-9][^"]*)"/);
  const tableId = tableM ? tableM[1] : "";

  // Walk <td> cells in document order. A label cell switches the current
  // category; the following 4-digit cells belong to that category.
  const cells = [...seg.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => {
    const raw = m[0];
    const clsM = raw.match(/class="([^"]*)"/);
    const cls = clsM ? clsM[1] : "";
    return { cls, txt: cleanTxt(m[1]) };
  });

  const numbers = [];
  let cat = null;
  for (const c of cells) {
    const labelM = CAT_RE.exec(c.txt);
    if (labelM) {
      const key = labelM[1] || labelM[2];
      if (key === "1st" || key === "2nd" || key === "3rd") cat = key;
      else if (/^special/i.test(key)) cat = "Special";
      else if (/^consolation/i.test(key)) cat = "Consolation";
      continue;
    }
    // Skip label text that leaked into a number cell (e.g. date/draw lines).
    const v = c.txt.replace(/\s+/g, "");
    if (/^\d{4}$/.test(v) && cat) numbers.push({ num: v, cat: CATS[cat] });
  }
  return { tableId, name, logo, dateLbl, dateIso, numbers };
}

function parsePage(html) {
  const out = [];
  const re = /class="card outer-box (table-[0-9][^"]*)" id="[^"]*">/g;
  let m;
  const starts = [];
  while ((m = re.exec(html))) starts.push({ table: m[1], i: m.index });
  for (let k = 0; k < starts.length; k++) {
    const end = k + 1 < starts.length ? starts[k + 1].i : html.length;
    const seg = html.slice(starts[k].i, end);
    const card = parseCard(seg);
    if (card.name) out.push(card);
  }
  return out;
}

function dateSeq(fromIso, days) {
  const out = [];
  const cur = new Date(fromIso + "T12:00:00Z");
  for (let i = 0; i < days; i++) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() - 1);
  }
  return out;
}

async function main() {
  // Scan ending the day before today (today's draw may be in progress).
  const now = new Date();
  const endIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)).toISOString().slice(0, 10);
  const days = Math.round((Date.parse(endIso + "T00:00:00Z") - Date.parse(START_ARG + "T00:00:00Z")) / 86400000) + 1;
  const dates = dateSeq(endIso, days).reverse(); // oldest -> newest

  const games = [];
  const gameKey = new Map();
  const byNum = new Map();
  let dayBase = epochDay(dates[0]);

  let done = 0;
  const CONC = 12;
  let idx = 0;
  async function worker() {
    while (idx < dates.length) {
      const d = dates[idx++];
      let html = "";
      try { html = await fetchText("https://live4dresult.net/past-results/" + d); } catch { /* ignore */ }
      if (html) {
        const cards = parsePage(html);
        const dayOff = epochDay(d) - dayBase;
        for (const card of cards) {
          // Guard against placeholder pages that render a different draw date.
          if (card.dateIso && card.dateIso !== d) continue;
          let gIdx = gameKey.get(card.name);
          if (gIdx === undefined) {
            gIdx = games.length;
            games.push({ name: card.name, logo: card.logo, table: card.tableId });
            gameKey.set(card.name, gIdx);
          }
          for (const n of card.numbers) {
            let arr = byNum.get(n.num);
            if (!arr) { arr = []; byNum.set(n.num, arr); }
            arr.push([dayOff, gIdx, n.cat]);
          }
        }
      }
      done++;
      if (done % 30 === 0) console.error(`  scanned ${done}/${dates.length} (${d})`);
    }
  }
  const workers = Array.from({ length: CONC }, () => worker());
  await Promise.all(workers);

  // compact hits: store per number
  const hits = {};
  for (const [num, arr] of byNum) {
    hits[num] = arr;
  }

  const db = {
    meta: {
      from: dates[0],
      to: dates[dates.length - 1],
      days: dates.length,
      built: new Date().toISOString(),
    },
    games,
    dayBase,
    hits,
  };
  fs.writeFileSync(outFile, JSON.stringify(db));
  const kb = Math.round(fs.statSync(outFile).size / 1024);
  console.error(`\nWrote ${outFile} (${kb} KB)`);
  console.error(`games: ${games.length}, numbers indexed: ${byNum.size}, total hits: ${[...byNum.values()].reduce((a, b) => a + b.length, 0)}`);

  // quick sanity for a few numbers
  const fromIso = dates[0];
  for (const probe of ["2609", "8888", "1288", "0063", "8320"]) {
    const arr = hits[probe] || [];
    const rows = arr.slice(0, 12).map(([dd, g, c]) => {
      const iso = isoFromEpoch(dayBase + dd);
      return `${fmtDate(iso)} ${games[g].name} cat=${c}`;
    });
    console.error(`\n# ${probe}: ${arr.length} hits`);
    for (const r of rows) console.error("   " + r);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });


