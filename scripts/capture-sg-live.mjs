// Capture the Singapore live feed while it is streaming.
//
// The operator's jLive feed reveals the draw number by number and then clears
// itself - typically within minutes. Taking a single look every five minutes
// therefore kept missing it: on 30/09 the 3:30pm-style Wednesday draw was
// finished and showing in the operator's own app while this job had captured
// nothing, and the site was left with the 27/09 numbers.
//
// So each run now WATCHES for several minutes, sampling every few seconds, and
// keeps every number it sees. Numbers are never dropped and the capture never
// goes back to an older draw.
//
//   node scripts/capture-sg-live.mjs
import fs from "node:fs";

const OUT = "data/sg-live.json";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const FEEDS = ["http://cloud.live4d.sg/api/sg4d/jlive", "http://alpha2.live4d.sg/api/sg4d/jlive", "http://alpha1.live4d.sg/api/sg4d/jlive"];

/** How long this run keeps watching, and how often it looks. */
const WATCH_MS = Number(process.env.SG_WATCH_MS || 4 * 60 * 1000);
const POLL_MS = Number(process.env.SG_POLL_MS || 12000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isoOf = (yyyymmdd) => yyyymmdd.slice(0, 4) + "-" + yyyymmdd.slice(4, 6) + "-" + yyyymmdd.slice(6, 8);
const pretty = (iso) => { const [y, m, d] = iso.split("-"); const dt = new Date(iso + "T12:00:00Z"); return d + "-" + m + "-" + y + " (" + ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dt.getUTCDay()] + ")"; };
const is4 = (v) => /^\d{4}$/.test(String(v || ""));

async function fetchFeed() {
  for (const url of FEEDS) {
    try {
      const r = await fetch(url + "?ts=" + Date.now(), { headers: { "User-Agent": UA, "Accept": "application/json", "Accept-Encoding": "identity" }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) continue;
      const j = await r.json();
      if (j && j.result && j.result.comp === "SG4D") return j.result;
    } catch { /* try the next feed */ }
  }
  return null;
}

/** Read whatever the feed currently shows. */
function readResult(res) {
  const out = { iso: null, prize: {}, starter: {}, cons: {}, confirmed: null };
  if (!res) return out;
  const dm = /^(\d{4})(\d{2})(\d{2})$/.exec(String(res.date || ""));
  if (dm) out.iso = dm[1] + "-" + dm[2] + "-" + dm[3];
  out.confirmed = res.confirmed || null;
  for (const item of res.n || []) {
    const v = String(item.i || "").trim();
    if (!is4(v)) continue;
    const p = String(item.p || "");
    const z = String(item.z || "").toUpperCase();
    if (/^[123]$/.test(p)) out.prize[p] = v;
    else if (/^S\d+$/.test(z)) out.starter[z.slice(1)] = v;
    else if (/^C\d+$/.test(z)) out.cons[z.slice(1)] = v;
  }
  // The first prize is also published in `flag`, before it reaches the list.
  if (!out.prize["1"] && is4(res.flag)) out.prize["1"] = res.flag;
  return out;
}

/** Never go back to an older draw, never lose a number already seen. */
function merge(prev, next) {
  if (!next.iso) return prev;
  if (!prev.iso || prev.iso !== next.iso) return { iso: next.iso, prize: { ...next.prize }, starter: { ...next.starter }, cons: { ...next.cons }, confirmed: next.confirmed };
  return {
    iso: prev.iso,
    prize: { ...prev.prize, ...next.prize },
    starter: { ...prev.starter, ...next.starter },
    cons: { ...prev.cons, ...next.cons },
    confirmed: next.confirmed || prev.confirmed,
  };
}

const countOf = (m) => Object.keys(m.prize).length + Object.keys(m.starter).length + Object.keys(m.cons).length;
const complete = (m) => ["1", "2", "3"].every((k) => is4(m.prize[k])) && Object.keys(m.starter).length >= 10 && Object.keys(m.cons).length >= 10;

const store = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { games: {} };
store.games = store.games || {};
let merged = store.games.singapore || { iso: null, prize: {}, starter: {}, cons: {}, confirmed: null };
const startedWith = countOf(merged);
const deadline = Date.now() + WATCH_MS;
let looks = 0;

while (true) {
  const now = readResult(await fetchFeed());
  looks++;
  if (now.iso) {
    const before = merged.iso + ":" + countOf(merged);
    merged = merge(merged, now);
    const after = merged.iso + ":" + countOf(merged);
    if (before !== after) console.log("  look " + looks + ": " + merged.iso + " - " + countOf(merged) + " numbers");
    if (complete(merged)) break;
  }
  if (Date.now() >= deadline) break;
  await sleep(POLL_MS);
}

console.log("watched " + looks + " time(s) for " + Math.round(WATCH_MS / 1000) + "s");

if (!merged.iso || countOf(merged) === 0) {
  console.log("feed had no numbers this run - nothing captured");
  process.exit(0);
}
// A NEW draw must be written even when it has fewer numbers than the old one;
// only skip when it is the same draw and nothing was added.
const drawChanged = !!merged.iso && merged.iso !== (store.games.singapore || {}).iso;
if (!drawChanged && countOf(merged) <= startedWith) {
  console.log("nothing new (still " + countOf(merged) + " numbers for " + merged.iso + ")");
  process.exit(0);
}

store.games.singapore = { ...merged, date: pretty(merged.iso) };
store.capturedAt = new Date().toISOString();
fs.writeFileSync(OUT, JSON.stringify(store, null, 1));

const missing = [];
for (const k of ["1", "2", "3"]) if (!merged.prize[k]) missing.push(k + (k === "1" ? "st" : k === "2" ? "nd" : "rd"));
console.log("captured Singapore " + merged.iso + ": " + countOf(merged) + " numbers" + (missing.length ? "  (still waiting for " + missing.join(", ") + ")" : "  (complete)"));
