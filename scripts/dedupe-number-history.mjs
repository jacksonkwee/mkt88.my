import fs from "node:fs";
const F = "src/components/sites/live4dresult-net-0600c55d/root-8a5edab2/number-history-db.json";
const db = JSON.parse(fs.readFileSync(F, "utf8"));
let before = 0, removed = 0;
for (const n of Object.keys(db.hits)) {
  const arr = db.hits[n]; before += arr.length;
  const seen = new Set(); const out = [];
  for (const h of arr) { const k = h[0] + "|" + h[1] + "|" + h[2]; if (seen.has(k)) { removed++; continue; } seen.add(k); out.push(h); }
  db.hits[n] = out;
}
db.meta.built = new Date().toISOString();
fs.writeFileSync(F, JSON.stringify(db));
console.log("duplicate records removed: " + removed + "   records now: " + (before - removed) + "   DB " + Math.round(fs.statSync(F).size/1024) + " KB");
