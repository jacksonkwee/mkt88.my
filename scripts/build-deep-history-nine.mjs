// Merge Nine Lotto 4D past results into the number-history database.
// The site only serves 2023-01-01 onwards; older dates repeat the latest draw,
// so anything before that cutoff is skipped on purpose.
//
//   node scripts/build-deep-history-nine.mjs [--from 2023-01-01]
import fs from "node:fs";

const DB_FILE = "src/components/sites/live4dresult-net-0600c55d/root-8a5edab2/number-history-db.json";
const DAY0 = Date.UTC(2020, 0, 1);
const epochDay = (iso) => Math.round((Date.parse(iso + "T00:00:00Z") - DAY0) / 86400000);
const isoFromEpoch = (d) => new Date(DAY0 + d * 86400000).toISOString().slice(0, 10);
const is4 = (v) => /^\d{4}$/.test(String(v || ""));

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const SP = [..."ABCDEFGHIJKLM"];
const CS = [..."NOPQRSTUVW"];

const argOf = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const FROM = argOf("--from") || "2023-01-01";

function textOf(html, id) {
  const m = new RegExp('id="' + id + '"[^>]*>([^<]{0,16})<').exec(html);
  return m ? m[1].trim() : "";
}

async function page(iso) {
  const [y, m, d] = iso.split("-");
  const url = `https://9lotto.com/result/${y}-${Number(m)}-${Number(d)}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Encoding": "identity" }, signal: AbortSignal.timeout(25000) });
    if (!r.ok) return null;
    const html = await r.text();
    // The page echoes the date it actually served - a mismatch means "no archive".
    const ph = /id="inputDate"[^>]*placeholder="([^"]+)"/.exec(html);
    if (!ph || ph[1] !== iso) return null;
    const prize = [textOf(html, "n1"), textOf(html, "n2"), textOf(html, "n3")];
    if (!is4(prize[0])) return null;
    const draw = /DRAW NO:[\s\S]{0,120}?<span>\s*([^<]+?)\s*<\/span>/.exec(html);
    return {
      prize,
      special: SP.map((L) => textOf(html, "n" + L)).filter(is4),
      cons: CS.map((L) => textOf(html, "n" + L)).filter(is4),
      drawNo: draw ? draw[1] : "",
    };
  } catch { return null; }
}

async function main() {
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  let gIdx = db.games.findIndex((g) => /nine ?lotto/i.test(g.name));
  if (gIdx < 0) {
    db.games.push({ name: "Nine Lotto 4D", logo: "/sites/live4dresult-net-0600c55d/root-8a5edab2/logo_ninelotto.png", table: "table-17" });
    gIdx = db.games.length - 1;
    console.log("added Nine Lotto as game index " + gIdx);
  }

  const have = new Set();
  const daysWithFirst = new Set();
  for (const num of Object.keys(db.hits)) {
    for (const [dd, g, c] of db.hits[num]) {
      have.add(num + "|" + dd + "|" + g + "|" + c);
      if (g === gIdx && c === 0) daysWithFirst.add(db.dayBase + dd);
    }
  }
  const push = (num, iso, cat) => {
    if (!is4(num)) return 0;
    const dd = epochDay(iso) - db.dayBase;
    if (have.has(num + "|" + dd + "|" + gIdx + "|" + cat)) return 0;
    have.add(num + "|" + dd + "|" + gIdx + "|" + cat);
    (db.hits[num] || (db.hits[num] = [])).push([dd, gIdx, cat]);
    return 1;
  };
  const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db));

  const today = new Date();
  const dates = [];
  for (let d = new Date(FROM + "T12:00:00"); d <= today; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (!daysWithFirst.has(epochDay(iso))) dates.push(iso);
  }
  console.log(`${dates.length} Nine Lotto dates to fetch (from ${FROM})`);

  let added = 0, draws = 0, missing = 0, done = 0, idx = 0;
  const CONC = 4;
  async function worker() {
    while (idx < dates.length) {
      const iso = dates[idx++];
      const rec = await page(iso);
      done++;
      if (!rec) missing++;
      else {
        draws++;
        added += push(rec.prize[0], iso, 0);
        added += push(rec.prize[1], iso, 1);
        added += push(rec.prize[2], iso, 2);
        for (const n of rec.special) added += push(n, iso, 3);
        for (const n of rec.cons) added += push(n, iso, 4);
      }
      if (done % 200 === 0) { save(); console.error(`  ${done}/${dates.length} (${draws} draws, ${added} hits)`); }
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()));

  db.meta.sources = [...new Set([...(db.meta.sources || []), "9lotto.com (official, 2023+)"])];
  db.meta.built = new Date().toISOString();
  save();
  console.log(`Nine Lotto: ${draws} draws stored, ${missing} dates unavailable (pre-2023), ${added} hits added`);
  console.log(`DB now ${Math.round(fs.statSync(DB_FILE).size / 1024)} KB`);
}

main().catch((e) => { console.error(e); process.exit(1); });