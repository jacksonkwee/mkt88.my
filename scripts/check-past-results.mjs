import { readFileSync } from "node:fs";
import { coreResultComplete, pastRecordStatus } from "../src/lib/past-completeness.mjs";

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

if (!base) {
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
