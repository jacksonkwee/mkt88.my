// Extend the bundled Lucky HariHari past results.
//
// HariHari was the last game on the past-results page still calling its feed on
// every new date. This fills the recent window so those dates open instantly.
//
// Re-runs only fetch dates that are missing or incomplete.
//
//   node scripts/build-hari-past.mjs --days 180
import fs from "node:fs";

const OUT = "src/lib/hari-past.json";
const API = "https://mkt88-my.vercel.app/api/cambodia-past?date=";
const SLOTS = ["15:30", "19:30"];
const WORKERS = 3;

const args = process.argv.slice(2);
const days = Number((args[args.indexOf("--days") + 1] || 180)) || 180;

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());

const store = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { from: "", to: "", days: {} };
store.days = store.days || {};

const have = (rec) => rec && SLOTS.every((s) => rec[s] && rec[s].set && (rec[s].set.prize || []).some((v) => /^\d{4}$/.test(v)));

const wanted = [];
const start = new Date();
for (let i = 1; i <= days; i++) {
  const key = iso(new Date(start.getTime() - i * 86400000));
  if (!have(store.days[key])) wanted.push(key);
}
console.log(`store has ${Object.keys(store.days).length} days, fetching ${wanted.length} more`);

let added = 0, empty = 0, failed = 0, done = 0;

async function grab(date) {
  try {
    const r = await fetch(API + date, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error("http " + r.status);
    const j = await r.json();
    const rec = {};
    for (const s of SLOTS) {
      const h = j.hari && j.hari[s];
      if (h && h.set && (h.set.prize || []).some((v) => /^\d{4}$/.test(v))) {
        rec[s] = { set: h.set, six: h.six || null, jp: h.jp || null };
      }
    }
    if (!Object.keys(rec).length) { empty++; return; }
    store.days[date] = { ...(store.days[date] || {}), ...rec };
    added++;
  } catch (e) {
    failed++;
    console.log(`  ${date} failed: ${String(e.message || e).slice(0, 60)}`);
  } finally {
    done++;
    if (done % 25 === 0) {
      save();
      console.log(`  ${done}/${wanted.length} checked, ${added} stored`);
    }
  }
}

function save() {
  const sorted = {};
  for (const k of Object.keys(store.days).sort()) sorted[k] = store.days[k];
  store.days = sorted;
  const keys = Object.keys(sorted);
  store.from = keys[0] || "";
  store.to = keys[keys.length - 1] || "";
  fs.writeFileSync(OUT, JSON.stringify(store), "utf8");
}

for (let i = 0; i < wanted.length; i += WORKERS) {
  await Promise.all(wanted.slice(i, i + WORKERS).map(grab));
  await new Promise((r) => setTimeout(r, 150));
}
save();
console.log(`done: +${added} days, ${empty} empty, ${failed} failed -> ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB, ${Object.keys(store.days).length} days)`);