// Fill the number-history database from live4d2u's number-history API.
//
// It is the only place that still holds Malaysian draws from the 1980s and 90s
// (Damacai before 2005, Singapore/Sandakan/Sabah88/Cash Sweep before 2022).
// The API answers "where did 8451 ever appear?", so we ask it for every number
// 0000-9999 and invert the answers into the database.
//
//   node scripts/build-history-live4d2u.mjs [--from 0] [--to 9999] [--conc 5]
import fs from "node:fs";

const DB_FILE = "src/components/sites/live4dresult-net-0600c55d/root-8a5edab2/number-history-db.json";
const PROGRESS = "scripts/.live4d2u-progress.json";
const API = "https://www.live4d2u.net/statapiweb.php";
const DAY0 = Date.UTC(2020, 0, 1);
const epochDay = (iso) => Math.round((Date.parse(iso + "T00:00:00Z") - DAY0) / 86400000);
const is4 = (v) => /^\d{4}$/.test(String(v || ""));
const PRIZE = { "1st": 0, "2nd": 1, "3rd": 2, "Special": 3, "Consolation": 4 };

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
// The API answers with the operator's icon name, which is not always the same
// as the checkbox name it was asked with (toto, cashsweep).
const OPERATOR = {
  magnum: /Magnum 4D/i,
  damacai: /Da Ma Cai 1\+3D/i,
  toto: /SportsToto 4D/i,
  sg4d: /Singapore 4D/i,
  stc4d: /Sandakan/i,
  sabah88: /Sabah 88/i,
  cashsweep: /CashSweep/i,
};
// checkbox name -> icon name
const ASK = { magnum: "magnum", damacai: "damacai", toto: "sportstoto", sg4d: "sg4d", stc4d: "stc4d", sabah88: "sabah88", cashsweep: "stec" };

const argOf = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const FROM = Number(argOf("--from", 0));
const TO = Number(argOf("--to", 9999));
const CONC = Number(argOf("--conc", 5));

async function lookup(num) {
  const p = new URLSearchParams({ num4d: num, permutation: "0" });
  for (const g of Object.values(ASK)) p.set(g, "1");
  const r = await fetch(API, {
    method: "POST",
    headers: { "User-Agent": UA, "Accept-Encoding": "identity", "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", Referer: "https://www.live4d2u.net/4d-history" },
    body: p.toString(),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) return null;
  const html = await r.text();
  const rows = [];
  const re = /<tr\s*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>/g;
  let m;
  while ((m = re.exec(html))) {
    const op = (/logo_([a-z0-9]+)\.(?:gif|png)/i.exec(m[1]) || [])[1] || "";
    const date = m[3].trim();
    const prize = m[4].trim();
    if (!op || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !(prize in PRIZE)) continue;
    rows.push({ op, date, prize });
  }
  return rows;
}

async function main() {
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  const gIdx = {};
  for (const [op, re] of Object.entries(OPERATOR)) {
    let i = db.games.findIndex((g) => re.test(g.name));
    if (i < 0) { db.games.push({ name: op, logo: "/images/logo_" + op + ".gif", table: "" }); i = db.games.length - 1; }
    gIdx[op] = i;
  }
  console.log("operators -> game indexes: " + JSON.stringify(gIdx));

  const have = new Set();
  for (const num of Object.keys(db.hits)) for (const [dd, g, c] of db.hits[num]) have.add(num + "|" + dd + "|" + g + "|" + c);
  const push = (num, iso, game, cat) => {
    if (!is4(num)) return 0;
    const dd = epochDay(iso) - db.dayBase;
    const key = num + "|" + dd + "|" + game + "|" + cat;
    if (have.has(key)) return 0;
    have.add(key);
    (db.hits[num] || (db.hits[num] = [])).push([dd, game, cat]);
    return 1;
  };
  const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db));

  const startNum = fs.existsSync(PROGRESS) ? (JSON.parse(fs.readFileSync(PROGRESS, "utf8")).next ?? FROM) : FROM;
  const numbers = [];
  for (let n = Math.max(FROM, startNum); n <= TO; n++) numbers.push(String(n).padStart(4, "0"));
  console.log(`${numbers.length} numbers to ask about (from ${String(numbers[0] || "").padStart(4, "0")})`);

  let added = 0, done = 0, failed = 0, rows = 0, idx = 0;
  const saveProgress = () => fs.writeFileSync(PROGRESS, JSON.stringify({ next: Number(numbers[Math.min(done, numbers.length - 1)] || TO) + 1, done, added }));

  async function worker() {
    while (idx < numbers.length) {
      const num = numbers[idx++];
      const rowsFor = await lookup(num);
      done++;
      if (!rowsFor) failed++;
      else {
        rows += rowsFor.length;
        for (const row of rowsFor) {
          const game = gIdx[row.op];
          if (game === undefined) continue;
          added += push(num, row.date, game, PRIZE[row.prize]);
        }
      }
      if (done % 500 === 0) { save(); saveProgress(); console.error(`  ${done}/${numbers.length} numbers, ${added} new hits, ${rows} rows seen`); }
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()));

  db.meta.sources = [...new Set([...(db.meta.sources || []), "live4d2u.net (number history, 1980s+)"])];
  db.meta.built = new Date().toISOString();
  save();
  saveProgress();
  console.log(`done: ${done} numbers asked, ${rows} rows returned, ${added} new hits added, ${failed} failed`);
  console.log(`DB now ${Math.round(fs.statSync(DB_FILE).size / 1024)} KB`);
}

main().catch((e) => { console.error(e); process.exit(1); });