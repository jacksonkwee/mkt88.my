// Bring the number-history database up to date.
//
// Run once a day by .github/workflows/number-history.yml. It only ever adds:
// a day upstream is slow or broken, nothing already stored is removed, and a
// run that would shrink the database fails instead of publishing.
//
//   node scripts/refresh-number-history.mjs
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const DB_FILE = "src/components/sites/mkt88/app/number-history-db.json";
const DAY0 = Date.UTC(2020, 0, 1);
const MY_OFFSET_MS = 8 * 60 * 60 * 1000;

const isoFromOffset = (d) => new Date(DAY0 + d * 86400000).toISOString().slice(0, 10);

/** The date `offset` days from today, in Malaysia. */
function myDay(offset = 0) {
  const d = new Date(Date.now() + MY_OFFSET_MS);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** The newest date the database actually holds a draw for. */
function newestStored(db) {
  let max = -Infinity;
  for (const list of Object.values(db.hits)) {
    for (const h of list) if (h[0] > max) max = h[0];
  }
  return Number.isFinite(max) ? isoFromOffset(db.dayBase + max) : "";
}

const countHits = (db) => Object.values(db.hits).reduce((n, l) => n + l.length, 0);

const run = (script, args) => {
  console.log("\n$ node scripts/" + script + (args && args.length ? " " + args.join(" ") : ""));
  execFileSync(process.execPath, ["scripts/" + script, ...(args || [])], { stdio: "inherit" });
};

const before = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
const hadHits = countHits(before);
const storedTo = newestStored(before);
const target = myDay(-1);

console.log("database holds draws to : " + storedTo);
console.log("catching up to          : " + target);

if (!storedTo) throw new Error("the database holds no draws at all - refusing to guess");

if (storedTo < target) {
  // The stored archive lives at live4dresult.net/past-results/<date>.
  const next = isoFromOffset((Date.parse(storedTo + "T00:00:00Z") - DAY0) / 86400000 + 1);
  run("merge-number-history-dates.mjs", [next, target]);
} else {
  console.log("already current - nothing to fetch");
}

// Perdana and HariHari are picked up from the files in the repo.
run("merge-local-history.mjs");

// Nine Lotto and Grand Dragon are NOT on the mirror the date merge reads, so
// they are read straight from their operators. Without this Nine Lotto sat
// frozen at 2026-09-28 while every other game moved on: the old comment here
// assumed the fifteen-minute results job would keep them current, and that job
// ran on GitHub Actions, which died with the account suspension.
for (const [game, label] of [["nine", "Nine Lotto"], ["gd", "Grand Dragon"]]) {
  const cur = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  const gi = cur.games.findIndex((g) => (game === "nine" ? /Nine ?Lotto/i : /Grand Dragon/i).test(g.name));
  if (gi < 0) { console.log(label + ": not in the database, skipped"); continue; }
  let max = -Infinity;
  for (const list of Object.values(cur.hits)) for (const [dd, g] of list) if (g === gi && dd > max) max = dd;
  if (!Number.isFinite(max)) { console.log(label + ": no draws stored, skipped"); continue; }
  const from = isoFromOffset(cur.dayBase + max + 1);
  if (from > target) { console.log(label + ": already current to " + target); continue; }
  run("merge-official-history.mjs", [game, from, target]);
}

const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
const after = countHits(db);
if (after < hadHits) {
  throw new Error("the database would shrink from " + hadHits + " to " + after + " records - refusing to publish");
}
if (Object.keys(db.hits).length < 10000) {
  throw new Error("only " + Object.keys(db.hits).length + " of the 10000 numbers are indexed");
}

const newest = newestStored(db);
if (newest > db.meta.to) db.meta.to = newest;
db.meta.days = Math.round((Date.parse(db.meta.to + "T00:00:00Z") - Date.parse(db.meta.from + "T00:00:00Z")) / 86400000) + 1;
db.meta.built = new Date().toISOString();
// The date stamp is what the live search reads to decide which days are
// missing. Without this it would keep re-fetching days that are already stored.
fs.writeFileSync(DB_FILE, JSON.stringify(db));

console.log("");
console.log("records  : " + hadHits + " -> " + after);
console.log("draws to : " + storedTo + " -> " + db.meta.to);
console.log("days     : " + db.meta.days);
