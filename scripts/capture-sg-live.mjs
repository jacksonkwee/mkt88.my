// Capture the Singapore live feed while it is streaming.
//
// The operator's jLive feed reveals the draw number by number and then clears
// itself, so a result that was visible for an hour used to vanish and the card
// fell back to the previous draw. This stores whatever has been revealed so far
// (numbers are never dropped, only added) and commits it, so the app keeps
// showing the current draw until Singapore Pools publishes the official one.
//
//   node scripts/capture-sg-live.mjs
import fs from "node:fs";

const OUT = "data/sg-live.json";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const FEEDS = ["http://cloud.live4d.sg/api/sg4d/jlive", "http://alpha2.live4d.sg/api/sg4d/jlive"];

const isoOf = (yyyymmdd) => yyyymmdd.slice(0, 4) + "-" + yyyymmdd.slice(4, 6) + "-" + yyyymmdd.slice(6, 8);
const pretty = (iso) => { const [y, m, d] = iso.split("-"); const dt = new Date(iso + "T12:00:00Z"); return d + "-" + m + "-" + y + " (" + ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dt.getUTCDay()] + ")"; };
const is4 = (v) => /^\d{4}$/.test(String(v || ""));

async function fetchFeed() {
  for (const url of FEEDS) {
    try {
      const r = await fetch(url + "?ts=" + Date.now(), { headers: { "User-Agent": UA, "Accept": "application/json", "Accept-Encoding": "identity" }, signal: AbortSignal.timeout(25000) });
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
  // the first prize is also published in `flag` before it appears in the list
  if (!out.prize["1"] && is4(res.flag)) out.prize["1"] = res.flag;
  return out;
}

const now = readResult(await fetchFeed());
if (!now.iso) { console.log("no live Singapore feed available - nothing to capture"); process.exit(0); }

const store = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { games: {} };
store.games = store.games || {};
const prev = store.games.singapore || {};
const sameDraw = prev.iso === now.iso;

// Never go back to an older draw, and never lose a number that was already seen.
const merged = sameDraw ? {
  iso: now.iso,
  prize: { ...(prev.prize || {}), ...now.prize },
  starter: { ...(prev.starter || {}), ...now.starter },
  cons: { ...(prev.cons || {}), ...now.cons },
  confirmed: now.confirmed || prev.confirmed || null,
} : { iso: now.iso, prize: now.prize, starter: now.starter, cons: now.cons, confirmed: now.confirmed };

const count = Object.keys(merged.prize).length + Object.keys(merged.starter).length + Object.keys(merged.cons).length;
if (count === 0) { console.log("feed had no numbers yet - nothing captured"); process.exit(0); }

store.games.singapore = { ...merged, date: pretty(merged.iso) };
store.capturedAt = new Date().toISOString();
fs.writeFileSync(OUT, JSON.stringify(store, null, 1));

const missing = [];
for (const k of ["1", "2", "3"]) if (!merged.prize[k]) missing.push(k + (k === "1" ? "st" : k === "2" ? "nd" : "rd"));
console.log("captured Singapore " + merged.iso + ": " + count + " numbers" + (missing.length ? "  (still waiting for " + missing.join(", ") + ")" : "  (complete)"));