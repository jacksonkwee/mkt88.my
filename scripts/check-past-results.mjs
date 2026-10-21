import { readFileSync } from "node:fs";
import { coreResultComplete, pastRecordStatus } from "../src/lib/past-completeness.mjs";

const fixtures = {
  "2026-10-17": ["8365", "4438", "0324"],
  "2026-10-18": ["3356", "3375", "1584"],
};
const base = (process.argv[2] || process.env.PAST_BASE_URL || "").replace(/\/+$/, "");

async function recordFor(date) {
  if (!base) {
    const store = JSON.parse(readFileSync(new URL("../src/lib/gd-nine-past.json", import.meta.url), "utf8"));
    return store[date];
  }
  const response = await fetch(`${base}/api/cambodia-past?date=${date}&verify=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${date} returned HTTP ${response.status}`);
  return response.json();
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
