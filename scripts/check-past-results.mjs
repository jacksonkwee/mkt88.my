import { existsSync, readFileSync } from "node:fs";
import { coreResultComplete, pastRecordStatus } from "../src/lib/past-completeness.mjs";

/*
 * The page's first source is now our own archive. Check that the archive can
 * still rebuild a known past draw before a deploy can replace a working site.
 */
const history = JSON.parse(readFileSync(new URL("../src/components/sites/mkt88/app/number-history-db.json", import.meta.url), "utf8"));
const DAY0 = Date.UTC(2020, 0, 1);
const dayOffset = (iso) => Math.round((Date.parse(iso + "T00:00:00Z") - DAY0) / 86400000) - history.dayBase;
const requiredTables = new Set(["table-1", "table-4", "table-6", "table-8", "table-9", "table-10", "table-11"]);
const fixtureOffset = dayOffset("2024-04-06");
const rebuilt = new Map();
for (const rows of Object.values(history.hits)) {
  for (const [day, gameIndex, prizeIndex] of rows) {
    if (day !== fixtureOffset) continue;
    const table = history.games[gameIndex]?.table;
    if (!requiredTables.has(table)) continue;
    let tiers = rebuilt.get(table);
    if (!tiers) rebuilt.set(table, tiers = new Set());
    tiers.add(prizeIndex);
  }
}
for (const table of requiredTables) {
  const tiers = rebuilt.get(table);
  if (!tiers || ![0, 1, 2].every((tier) => tiers.has(tier))) {
    throw new Error(`Local past archive cannot rebuild ${table} for 2024-04-06`);
  }
}

const archiveFile = process.env.MKT88_PAST_STORE || new URL("../data/past-archive.json", import.meta.url);
if (existsSync(archiveFile)) {
  const archive = JSON.parse(readFileSync(archiveFile, "utf8"));
  for (const [date, entry] of Object.entries(archive)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !String(entry?.html || "").includes('class="card outer-box')) {
      throw new Error(`Local app archive has an invalid entry for ${date}`);
    }
  }
}

/*
 * This guard validates the archive that the Windows scheduled tasks harvest on
 * the owner's PC. Vercel only ever sees the copy committed at push time, which
 * is usually a day behind, so the check failed there and blocked two deploys
 * (22 and 23 Oct 2026) for data that was never actually broken. It still runs
 * in full on the machine that produces the data.
 */
if (process.env.VERCEL) {
  console.log("check-past-results: skipped on Vercel (validated locally instead)");
  process.exit(0);
}

const fixtures = {
  "2026-10-17": ["8365", "4438", "0324"],
  "2026-10-18": ["3356", "3375", "1584"],
};
const base = (process.argv[2] || process.env.PAST_BASE_URL || "").replace(/\/+$/, "");

const store = base
  ? null
  : JSON.parse(readFileSync(new URL("../src/lib/gd-nine-past.json", import.meta.url), "utf8"));
const klDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
});

async function recordFor(date) {
  if (!base) return store[date];
  const response = await fetch(`${base}/api/cambodia-past?date=${date}&verify=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${date} returned HTTP ${response.status}`);
  return response.json();
}

if (!base && process.env.MKT88_DEPLOYMENT_BUILD !== "1") {
  const missing = [];
  for (let i = 1; i <= 30; i++) {
    const date = klDay.format(new Date(Date.now() - i * 86400000));
    const record = await recordFor(date);
    if (!record || !coreResultComplete(record, "gd") || !coreResultComplete(record, "nine")) {
      missing.push(date);
    }
  }
  if (missing.length) throw new Error("Recent past-result archive incomplete: " + missing.join(", "));
  console.log("Recent 30-day past archive OK");
} else if (!base) {
  console.log("Recent 30-day past archive skipped for deployment build");
}

for (const [date, expected] of Object.entries(fixtures)) {
  const record = await recordFor(date);
  const status = record?.status || record?._status;
  if (!record || !coreResultComplete(record, "gd") || status?.gd !== "complete") {
    throw new Error(`${date}: Grand Dragon is incomplete ${JSON.stringify(status || pastRecordStatus(record || {}))}`);
  }
  const actual = record.gd.prize.slice(0, 3);
  if (actual.join("/") !== expected.join("/")) {
    throw new Error(`${date}: expected ${expected.join("/")}, got ${actual.join("/")}`);
  }
  if (record.gd6 && !coreResultComplete({ gd6: record.gd6 }, "gd6")) {
    throw new Error(`${date}: Grand Dragon 6D is malformed`);
  }
  console.log(`${date} past result OK: ${actual.join("/")}`);
}
