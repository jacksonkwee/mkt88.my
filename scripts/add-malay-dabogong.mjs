// Adds a Bahasa Malaysia term to every 大伯公 dictionary entry, using the public
// 200k English-Malay word list (malaysia-ai/malaysian-dataset).
import fs from "node:fs";

const DICT = "src/components/dabogong-dict.json";
const EN_MS = "uploads/en-ms.json";

const pairs = JSON.parse(fs.readFileSync(EN_MS, "utf8"));
const map = new Map();
for (const p of pairs) {
  if (!Array.isArray(p)) continue;
  const en = String(p[0] || "").trim().toLowerCase();
  const ms = String(p[1] || "").trim().toLowerCase();
  if (!en || !ms || en === ms) continue;
  if (!map.has(en)) map.set(en, ms);
}
console.log("en->ms pairs usable:", map.size);

function translate(text) {
  const t = String(text || "").trim().toLowerCase();
  if (!t) return "";
  if (map.has(t)) return map.get(t);
  const words = t.split(/[^a-z]+/).filter((w) => w.length > 2);
  const out = words.map((w) => map.get(w) || "").filter(Boolean);
  return out.length ? out.join(" ") : "";
}

const db = JSON.parse(fs.readFileSync(DICT, "utf8"));
let withMs = 0;
for (const [num, val] of Object.entries(db.e)) {
  const en = val[1] || "";
  const ms = translate(en);
  if (ms) { db.e[num] = [val[0], en, ms]; withMs++; }
}
db.malayBuilt = new Date().toISOString();
fs.writeFileSync(DICT, JSON.stringify(db));
const kb = Math.round(fs.statSync(DICT).size / 1024);
console.log("entries:", Object.keys(db.e).length, "| with Malay:", withMs, "| file KB:", kb);
for (const probe of ["666", "601", "8261", "0879", "0511"]) {
  const v = db.e[probe];
  console.log(" ", probe, JSON.stringify(v));
}
