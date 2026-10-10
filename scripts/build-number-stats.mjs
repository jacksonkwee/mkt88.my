/**
 * Build the all-time statistics used by the /statistics page.
 *
 * Source: number-history-db.json - the merged 1985-2026 draw history. Each hit is
 * [dayOffset, gameIndex, prizeTier] and the real date is
 *   2020-01-01 + (dayBase + dayOffset) days
 * (see number-history/engine.ts). Verified against Magnum's own Wed/Sat/Sun draw
 * days: 81.7% of its 1st-prize records land on those days.
 */
import fs from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
const DB = path.join(ROOT, "src/components/sites/live4dresult-net-0600c55d/root-8a5edab2/number-history-db.json");
const OUT = path.join(ROOT, "src/lib/number-stats.json");

const j = JSON.parse(fs.readFileSync(DB, "utf8"));
const DAY0 = Date.UTC(2020, 0, 1);
const iso = (dd) => new Date(DAY0 + (j.dayBase + dd) * 86400000).toISOString().slice(0, 10);

// The 11 games the app actually shows, in the app's order.
const GAMES = [
  ["magnum", "Magnum 4D", "萬能", 3],
  ["damacai", "Da Ma Cai 1+3D", "大馬彩", 11],
  ["sportstoto", "Sports Toto 4D", "多多", 7],
  ["singapore", "Singapore 4D", "新加坡", 6],
  ["sabah88", "Sabah 88 4D", "沙巴88", 13],
  ["cashsweep", "Cash Sweep 4D", "砂勞越大萬", 10],
  ["sandakan", "Sandakan 4D", "山打根", 9],
  ["granddragon", "Grand Dragon 4D", "豪龙", 0],
  ["ninelotto", "Nine Lotto 4D", "九宫格", 14],
  ["perdana", "Perdana 4D", "Perdana", 1],
  ["lucky", "Lucky HariHari 4D", "天天好运", 2],
];

const out = { generated: new Date().toISOString().slice(0, 10), games: [] };
for (const [key, name, zh, gi] of GAMES) {
  const appear = new Map();   // number -> total appearances (any prize)
  const asFirst = new Map();  // number -> times it was 1st prize
  const last = new Map();     // number -> latest day offset
  let draws = 0, dmin = 1e9, dmax = -1e9;

  for (const [num, arr] of Object.entries(j.hits)) {
    for (const [dd, g, tier] of arr) {
      if (g !== gi) continue;
      appear.set(num, (appear.get(num) || 0) + 1);
      if (tier === 0) { asFirst.set(num, (asFirst.get(num) || 0) + 1); draws++; }
      const p = last.get(num);
      if (p === undefined || dd > p) last.set(num, dd);
      if (dd < dmin) dmin = dd;
      if (dd > dmax) dmax = dd;
    }
  }
  const hot = [...appear.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([num, count]) => ({ num, count, first: asFirst.get(num) || 0, last: iso(last.get(num)) }));

  out.games.push({
    key, name, zh, draws,
    from: dmin === 1e9 ? null : iso(dmin),
    to: dmax === -1e9 ? null : iso(dmax),
    totalAppearances: [...appear.values()].reduce((s, v) => s + v, 0),
    hot,
  });
  console.log(name.padEnd(22) + " draws=" + String(draws).padEnd(6) + iso(dmin) + " -> " + iso(dmax) + "   hot#1: " + hot[0].num + " (" + hot[0].count + "x)");
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1), "utf8");
console.log("\nwrote " + OUT + "  (" + (fs.statSync(OUT).size / 1024).toFixed(1) + " KB)");
