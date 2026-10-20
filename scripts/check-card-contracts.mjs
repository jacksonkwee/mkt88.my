import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const ids = new Set();

function collectIds(value) {
  if (typeof value === "string") {
    for (const match of value.matchAll(/data-id\s*=\s*["']([^"']+)["']/gi)) ids.add(match[1]);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (typeof value["data-id"] === "string") ids.add(value["data-id"]);
  for (const item of Object.values(value)) collectIds(item);
}

for (const file of [
  "src/components/sites/mkt88/app/cards-data.json",
  "src/components/sites/mkt88/app/lotto-data.json",
  "src/components/sites/mkt88/app/snapshots/sabah-sarawak-4d-results.content.json",
  "src/components/sites/mkt88/app/snapshots/singapore-4d-results.content.json",
]) collectIds(JSON.parse(read(file)));

// Ids the east-card builders add after reading the captured page.
for (const file of ["src/components/sites/mkt88/app/east-cards.ts", "src/components/sites/mkt88/app/six-split.ts"]) {
  for (const match of read(file).matchAll(/["'](?:data-id["']\s*:\s*["'])?([a-z][a-z0-9_]*)["']/gi)) ids.add(match[1]);
}

const required = {
  "Grand Dragon 4D": ["jp4_pool", "jp4_letter", "jp4_units"],
  "Grand Dragon 6D": ["jp7_pool", "jp7_grand"],
  "East 4D jackpots": ["jackpot1_prize", "jackpot2_prize"],
  "East 3D": ["first_d3_prize", "second_d3_prize", "third_d3_prize"],
};

const missing = Object.entries(required)
  .flatMap(([group, keys]) => keys.filter((key) => !ids.has(key)).map((key) => group + ": " + key));
if (missing.length) throw new Error("Card binding contract failed:\n" + missing.join("\n"));

console.log("Card binding contract OK: " + ids.size + " rendered ids checked");
