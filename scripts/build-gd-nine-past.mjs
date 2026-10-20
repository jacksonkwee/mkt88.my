// Bundle Grand Dragon + Nine Lotto past results.
//
// Those two are the only games whose past pages still call out to the official
// sites on every new date. Reading them once and storing the fields the page
// needs makes a first-time date open instantly.
//
// Re-runs only fetch dates that are missing from the store.
//
//   node scripts/build-gd-nine-past.mjs --days 180
import fs from "node:fs";

const OUT = "src/lib/gd-nine-past.json";
const API = "https://mkt88-my.vercel.app/api/cambodia-past?date=";
const FIELDS = ["gd", "nine", "gd6", "gdjp4", "gdjp7", "nine6", "nineJp"];

const args = process.argv.slice(2);
const days = Number((args[args.indexOf("--days") + 1] || 180)) || 180;
const waitMs = 250;

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());

const store = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};

const wanted = [];
const start = new Date();
for (let i = 1; i <= days; i++) {
  const d = new Date(start.getTime() - i * 86400000);
  const key = iso(d);
  /*
   * A date that is stored but has no Grand Dragon block is still missing its
   * result - the operator was refused that day and the record was written with
   * gd: null. Those are re-fetched for the last 30 days instead of being
   * skipped for ever.
   */
  if (!store[key] || (!store[key].gd && i <= 30)) wanted.push(key);
}

console.log(`store has ${Object.keys(store).length} days, fetching ${wanted.length} more`);

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36";

/**
 * Grand Dragon from the mirror's dated past-results page.
 *
 * The operator's own site is the original source, but it is behind Cloudflare
 * and refuses our requests for long stretches - which is why every recent day
 * was stored with gd: null. The mirror keeps the same 4D board for each date:
 * three prizes, thirteen specials and ten consolations, in the card's own
 * data-ids.
 */
async function gdFromMirror(date) {
  try {
    const r = await fetch(`https://live4dresult.net/past-results/${date}/`, {
      headers: { "user-agent": UA, accept: "text/html" },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return null;
    const html = await r.text();
    const from = html.indexOf(`id="table-13-`);
    if (from < 0) return null;
    const next = html.indexOf(`id="table-14-`, from);
    const seg = html.slice(from, next > from ? next : from + 30000);
    const get = (id) => {
      const m = new RegExp(`data-id="${id}">\\s*([^<]*)<`).exec(seg);
      return m ? m[1].trim() : "";
    };
    const norm = (v) => (/^\d{1,4}$/.test(v) ? v.padStart(4, "0") : "----");
    const prize = ["first_prize", "second_prize", "third_prize"].map(get);
    if (!prize.some((v) => /^\d{1,4}$/.test(v))) return null;
    return {
      prize: prize.map(norm),
      special: Array.from({ length: 13 }, (_, i) => norm(get("special-" + (i + 1)))),
      cons: Array.from({ length: 10 }, (_, i) => norm(get("consolation-" + (i + 1)))),
    };
  } catch { return null; }
}

let added = 0, empty = 0, failed = 0;
for (const date of wanted) {
  try {
    const r = await fetch(API + date, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error("http " + r.status);
    const j = await r.json();
    const rec = {};
    for (const f of FIELDS) if (j[f] !== undefined) rec[f] = j[f];
    // The operator refused: take the same board from the mirror's dated page.
    if (!rec.gd) {
      const gdm = await gdFromMirror(date);
      if (gdm) rec.gd = gdm;
    }
    // A date with neither game is not worth storing - the live path will retry it.
    if (!rec.gd && !rec.nine) { empty++; continue; }
    store[date] = rec;
    added++;
    if (added % 20 === 0) {
      fs.writeFileSync(OUT, JSON.stringify(store), "utf8");
      console.log(`  ${added} days stored (latest ${date})`);
    }
  } catch (e) {
    failed++;
    console.log(`  ${date} failed: ${String(e.message || e).slice(0, 60)}`);
  }
  await new Promise((r) => setTimeout(r, waitMs));
}

const sorted = {};
for (const k of Object.keys(store).sort()) sorted[k] = store[k];
fs.writeFileSync(OUT, JSON.stringify(sorted), "utf8");
console.log(`done: +${added} days, ${empty} empty, ${failed} failed -> ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB, ${Object.keys(sorted).length} days)`);
