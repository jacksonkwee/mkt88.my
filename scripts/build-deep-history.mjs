// Merge official Magnum 4D draw results (1985 -> archive era) into the
// number-history database so single-number history goes back to 25/08/1985.
// Run: node scripts/build-deep-history.mjs
import fs from "node:fs";

const DB_FILE = "src/components/sites/live4dresult-net-0600c55d/root-8a5edab2/number-history-db.json";
const START = "1985-08-25";
const END = "2022-07-26"; // live4dresult archive takes over from 2022-07-27
const URL = `https://www.magnum4d.my/results/past/between-dates/${START}/${END}/8000`;

const DAY0 = Date.UTC(2020, 0, 1);
const epochDay = (iso) => Math.round((Date.parse(iso + "T00:00:00Z") - DAY0) / 86400000);

function isoFromDmy(dmy) {
  const [d, m, y] = dmy.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
const is4 = (v) => /^\d{4}$/.test(String(v || ""));

async function main() {
  const res = await fetch(URL, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
  if (!res.ok) throw new Error("magnum " + res.status);
  const draws = await res.json();
  if (!Array.isArray(draws) || !draws.length) throw new Error("no draws returned");

  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  let gIdx = db.games.findIndex((g) => /magnum 4d/i.test(g.name));
  if (gIdx < 0) {
    db.games.push({ name: "Magnum 4D 萬能", logo: "/wp-content/themes/oldtheme-lottery-frontend/assets/images/logo_magnum.gif?v=1", table: "table-1" });
    gIdx = db.games.length - 1;
  }

  const push = (num, dateIso, cat) => {
    if (!is4(num)) return 0;
    const dd = epochDay(dateIso) - db.dayBase;
    const arr = db.hits[num] || (db.hits[num] = []);
    arr.push([dd, gIdx, cat]);
    return 1;
  };

  let added = 0;
  let oldest = null;
  for (const d of draws) {
    if (!d.DrawDate) continue;
    const iso = isoFromDmy(d.DrawDate);
    if (!oldest || iso < oldest) oldest = iso;
    added += push(d.FirstPrize, iso, 0);
    added += push(d.SecondPrize, iso, 1);
    added += push(d.ThirdPrize, iso, 2);
    for (let i = 1; i <= 10; i++) added += push(d["Special" + i], iso, 3);
    for (let i = 1; i <= 10; i++) added += push(d["Console" + i], iso, 4);
  }

  db.meta.from = oldest < db.meta.from ? oldest : db.meta.from;
  db.meta.days = Math.round((Date.parse(db.meta.to + "T00:00:00Z") - Date.parse(db.meta.from + "T00:00:00Z")) / 86400000) + 1;
  db.meta.sources = [...new Set([...(db.meta.sources || ["live4dresult.net"]), "magnum4d.my (official, 1985+)"])];
  db.meta.built = new Date().toISOString();

  fs.writeFileSync(DB_FILE, JSON.stringify(db));
  const kb = Math.round(fs.statSync(DB_FILE).size / 1024);
  console.log(`Magnum draws merged: ${draws.length} (oldest ${oldest})`);
  console.log(`Hits added: ${added}`);
  console.log(`DB now: ${kb} KB, records from ${db.meta.from} to ${db.meta.to}, numbers indexed ${Object.keys(db.hits).length}`);
  // sanity: when does 2609 appear?
  const hits = (db.hits["2609"] || []).map(([dd, g, c]) => [new Date(DAY0 + (db.dayBase + dd) * 86400000).toISOString().slice(0, 10), db.games[g].name, c]).sort();
  console.log("2609 earliest:", JSON.stringify(hits.slice(0, 4)));
}

main().catch((e) => { console.error(e); process.exit(1); });
