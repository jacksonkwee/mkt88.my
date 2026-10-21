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
const datesAt = args.indexOf("--dates");
const explicitDates = datesAt >= 0
  ? String(args[datesAt + 1] || "").split(",").map((d) => d.trim()).filter(Boolean)
  : [];
const waitMs = 250;

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());

const store = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};

const wanted = [];
if (explicitDates.length) {
  wanted.push(...explicitDates);
} else {
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

const GD_LETTERS = "ABCDEFGHIJKLM";
const GD_CONS = "NOPQRSTUVW";
const sixParts = (main) => ({
  six_2a: main.slice(0, 5), six_2b: main.slice(1),
  six_3a: main.slice(0, 4), six_3b: main.slice(2),
  six_4a: main.slice(0, 3), six_4b: main.slice(3),
  six_5a: main.slice(0, 2), six_5b: main.slice(4),
});
const usd = (value) => {
  const match = String(value ?? "").match(/[\d,.]+/);
  const n = match ? Number(match[0].replace(/,/g, "")) : NaN;
  return Number.isFinite(n) && n > 0
    ? "USD " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "";
};

/** The operator's app API is the cleanest source for a settled 4D board. */
async function gdFromOfficial(date) {
  const [y, m, d] = date.split("-").map(Number);
  for (const host of ["result.gdlotto.net", "result.gdlotto.com"]) {
    try {
      const r = await fetch(`https://${host}/api/result/${y}/${m}/${d}`, {
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) continue;
      const j = await r.json();
      if (!j || String(j.DrawDate || "").slice(0, 10) !== date) continue;
      const winners = [j.DrawNumber1, j.DrawNumber2, j.DrawNumber3].map((v) => String(v || "").toUpperCase());
      if (!winners.every((L) => /^[A-W]$/.test(L))) continue;
      const val = (L) => {
        const v = String(j["DrawNumber" + L] || "").trim();
        return /^\d{4}$/.test(v) ? v : "----";
      };
      const gd = {
        prize: winners.map(val),
        special: [...GD_LETTERS].map((L) => winners.includes(L) ? "----" : val(L)),
        cons: [...GD_CONS].map((L) => winners.includes(L) ? "----" : val(L)),
      };
      const main = String(j.DrawNumber6D || "").trim();
      const gd6 = /^\d{6}$/.test(main) ? { main, subs: sixParts(main) } : null;
      const gdjp4 = {};
      const pool4 = usd(j.JackpotPrize);
      if (pool4) gdjp4.jp4_pool = pool4;
      const letter4 = String(j.DrawNumberJackpot || "").trim().toUpperCase();
      if (/^[A-M]$/.test(letter4)) {
        const number = String(j.JackpotNumber || "").trim();
        gdjp4.jp4_letter = letter4 + (/^\d{4}$/.test(number) ? " : " + number : "");
      }
      const units4 = String(j.JackpotWinner || "").trim();
      if (/^\d+$/.test(units4)) gdjp4.jp4_units = units4;
      const gdjp7 = {};
      const same7 = String(j.Jackpot61DDate || "").slice(0, 10) === date;
      if (same7) {
        const pool7 = usd(j.Jackpot61DPool);
        const seven = String(j.DrawNumber7D || "").trim();
        if (pool7) gdjp7.jp7_pool = pool7;
        if (/^\d{7}$/.test(seven)) gdjp7.jp7_grand = seven.slice(0, 6) + " + " + seven.slice(6);
      }
      return {
        gd, gd6,
        gdjp4: Object.keys(gdjp4).length ? gdjp4 : null,
        gdjp7: Object.keys(gdjp7).length ? gdjp7 : null,
      };
    } catch { /* try the other host */ }
  }
  return null;
}

/** 4dking carries the settled 6D and 6+1D values even when the official 7D date lags. */
async function gdFrom4DKing(date) {
  try {
    const r = await fetch(`https://mapp.4dking.live/past_results_v23.php?d=${date}`, {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const list = await r.json();
    const four = list.find((x) => x?.type === "GD")?.fdData;
    const sixRaw = list.find((x) => x?.type === "GD6D")?.jpData1;
    const six = Array.isArray(sixRaw) ? sixRaw[0] : sixRaw;
    if (!four && !six) return null;
    const cell = (v) => {
      const s = String(v ?? "").trim();
      return !s || s === "-" ? "----" : s;
    };
    const gd = four ? {
      prize: [1, 2, 3].map((n) => cell(four["n" + n])),
      special: Array.from({ length: 13 }, (_, i) => cell(four["s" + (i + 1)])),
      cons: Array.from({ length: 10 }, (_, i) => cell(four["c" + (i + 1)])),
    } : null;
    const gdjp4 = four ? {
      ...(usd(four.JackpotPrize) ? { jp4_pool: usd(four.JackpotPrize) } : {}),
      ...(/^[A-M]$/i.test(String(four.DrawNumberJackpot || "")) ? { jp4_letter: String(four.DrawNumberJackpot).toUpperCase() } : {}),
      ...(/^\d+$/.test(String(four.JackpotWinner ?? "")) ? { jp4_units: String(four.JackpotWinner) } : {}),
    } : null;
    const main = String(six?.n1 || "").trim();
    const gd6 = /^\d{6}$/.test(main) ? { main, subs: sixParts(main) } : null;
    const gdjp7 = {};
    const pool7 = usd(six?.jp1);
    if (pool7) gdjp7.jp7_pool = pool7;
    if (/^\d{6}$/.test(main) && /^\d$/.test(String(six?.d1 || ""))) gdjp7.jp7_grand = main + " + " + six.d1;
    return {
      gd, gd6,
      gdjp4: gdjp4 && Object.keys(gdjp4).length ? gdjp4 : null,
      gdjp7: Object.keys(gdjp7).length ? gdjp7 : null,
    };
  } catch { return null; }
}

let added = 0, empty = 0, failed = 0;
for (const date of wanted) {
  try {
    let j = {};
    try {
      const r = await fetch(API + date, { signal: AbortSignal.timeout(60000) });
      if (r.ok) j = await r.json();
    } catch { /* direct sources below still work */ }
    const rec = {};
    for (const f of FIELDS) if (j[f] !== undefined) rec[f] = j[f];
    if (!rec.gd || !rec.gd6 || !rec.gdjp4 || !rec.gdjp7) {
      const [official, king] = await Promise.all([gdFromOfficial(date), gdFrom4DKing(date)]);
      rec.gd ||= official?.gd || king?.gd || null;
      rec.gd6 ||= king?.gd6 || official?.gd6 || null;
      rec.gdjp4 ||= official?.gdjp4 || king?.gdjp4 || null;
      rec.gdjp7 ||= king?.gdjp7 || official?.gdjp7 || null;
    }
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
