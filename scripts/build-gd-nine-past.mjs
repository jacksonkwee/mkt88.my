// Bundle Grand Dragon + Nine Lotto past results.
//
// Those two are the only games whose past pages still call out to the official
// sites on every new date. Reading them once and storing the fields the page
// needs makes a first-time date open instantly.
//
// Re-runs only fetch dates that are missing from the store.
//
//   node scripts/build-gd-nine-past.mjs --days 180
import fs from "node:fs";

const OUT = "src/lib/gd-nine-past.json";
const API = "https://mkt88-my.vercel.app/api/cambodia-past?date=";
const FIELDS = ["gd", "nine", "gd6", "gdjp4", "gdjp7", "nine6", "nineJp"];

const args = process.argv.slice(2);
const days = Number((args[args.indexOf("--days") + 1] || 180)) || 180;
const waitMs = 250;

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());

const store = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};

const wanted = [];
const start = new Date();
for (let i = 1; i <= days; i++) {
  const d = new Date(start.getTime() - i * 86400000);
  const key = iso(d);
  if (!store[key]) wanted.push(key);
}

console.log(`store has ${Object.keys(store).length} days, fetching ${wanted.length} more`);

let added = 0, empty = 0, failed = 0;
for (const date of wanted) {
  try {
    const r = await fetch(API + date, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error("http " + r.status);
    const j = await r.json();
    const rec = {};
    for (const f of FIELDS) if (j[f] !== undefined) rec[f] = j[f];
    // A date with neither game is not worth storing - the live path will retry it.
    if (!rec.gd && !rec.nine) { empty++; continue; }
    store[date] = rec;
    added++;
    if (added % 20 === 0) {
      fs.writeFileSync(OUT, JSON.stringify(store), "utf8");
      console.log(`  ${added} days stored (latest ${date})`);
    }
  } catch (e) {
    failed++;
    console.log(`  ${date} failed: ${String(e.message || e).slice(0, 60)}`);
  }
  await new Promise((r) => setTimeout(r, waitMs));
}

const sorted = {};
for (const k of Object.keys(store).sort()) sorted[k] = store[k];
fs.writeFileSync(OUT, JSON.stringify(sorted), "utf8");
console.log(`done: +${added} days, ${empty} empty, ${failed} failed -> ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB, ${Object.keys(sorted).length} days)`);