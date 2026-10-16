// Merge draws for the games the mirror does not carry, straight from the
// operator, into the offline number-history database.
//
// The daily refresh scrapes live4dresult.net, and that mirror does not carry
// Nine Lotto - which is why Nine Lotto sat frozen at 2026-09-28 while every
// other game moved on. Grand Dragon's early years are missing for the same
// reason. Both operators publish by date, so this fills them in.
//
// Add-only, exactly like the other merge scripts: nothing already stored is
// removed, and a run that would shrink the database throws instead of writing.
//
//   node scripts/merge-official-history.mjs nine 2026-09-29 2026-10-09
//   node scripts/merge-official-history.mjs gd   2020-05-01 2022-04-20
import fs from "node:fs";

const DB_FILE = "src/components/sites/mkt88/app/number-history-db.json";
const DAY0 = Date.UTC(2020, 0, 1);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const SPECIAL = [..."ABCDEFGHIJKLM"];
const CONS = [..."NOPQRSTUVW"];

const [game, FROM, TO] = process.argv.slice(2);
if (!game || !FROM || !TO) throw new Error("usage: node scripts/merge-official-history.mjs <nine|gd> <fromIso> <toIso>");
const GAME_RE = game === "nine" ? /Nine ?Lotto/i : game === "gd" ? /Grand Dragon/i : null;
if (!GAME_RE) throw new Error("game must be nine or gd");

const epochDay = (iso) => Math.round((Date.parse(iso + "T00:00:00Z") - DAY0) / 86400000);
const dmy = (iso) => { const [y, m, d] = iso.split("-"); return d + "/" + m + "/" + y; };

/** First 4-digit number inside an element with this id. */
function cell(html, id) {
  const m = new RegExp('id="' + id + '"[^>]*>([\\s\\S]{0,200}?)<', "i").exec(html);
  if (!m) return "";
  const v = (/\d{4}/.exec(m[1]) || [""])[0];
  return v;
}

async function get(url, ms = 25000, extra = {}) {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,*/*", ...extra }, signal: AbortSignal.timeout(ms) });
    if (!r.ok) return "";
    return await r.text();
  } catch { return ""; }
}

/** Nine Lotto: 9lotto.com/result/<y>-<m>-<d>, ids n1 n2 n3, nA..nM, nN..nW. */
async function nineDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const html = await get("https://9lotto.com/result/" + y + "-" + m + "-" + d);
  if (!html) return null;
  const ph = /id="inputDate"[^>]*placeholder="(\d{4}-\d{2}-\d{2})"/i.exec(html);
  if (ph && ph[1] !== iso) return null;                 // operator still showing another date
  const nums = ["n1", "n2", "n3"].map((id) => cell(html, id));
  const specials = SPECIAL.map((L) => cell(html, "n" + L));
  const cons = CONS.map((L) => cell(html, "n" + L));
  if (![...nums, ...specials, ...cons].some((v) => /^\d{4}$/.test(v))) return null;
  return { nums, specials, cons };
}

/** Grand Dragon: gdlotto.com ajax by date, ids 1stPz..3rdPz, PzA..PzM, PzN..PzW. */
async function gdDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const html = await get("https://www.gdlotto.com/results/ajax/_result.aspx?past=1&v=1&d=" + m + "/" + d + "/" + y, 25000,
    { "x-requested-with": "XMLHttpRequest", referer: "https://www.gdlotto.com/results/past" });
  if (!html) return null;
  // The response carries its own draw date - refuse anything that is not the day asked for.
  if (!html.includes(dmy(iso))) return null;
  const nums = ["1stPz", "2ndPz", "3rdPz"].map((id) => cell(html, id));
  const specials = SPECIAL.map((L) => cell(html, "Pz" + L));
  const cons = CONS.map((L) => cell(html, "Pz" + L));
  if (![...nums, ...specials, ...cons].some((v) => /^\d{4}$/.test(v))) return null;
  return { nums, specials, cons };
}

const dayFn = game === "nine" ? nineDay : gdDay;

const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
const gi = db.games.findIndex((g) => GAME_RE.test(g.name));
if (gi < 0) throw new Error("game not found in DB: " + game);

const before = Object.values(db.hits).reduce((n, l) => n + l.length, 0);
const have = new Set();
for (const num of Object.keys(db.hits)) for (const [dd, g, c] of db.hits[num]) have.add(num + "|" + dd + "|" + g + "|" + c);

const dates = [];
for (let t = Date.parse(FROM + "T00:00:00Z"); t <= Date.parse(TO + "T00:00:00Z"); t += 86400000) dates.push(new Date(t).toISOString().slice(0, 10));

let idx = 0, added = 0, days = 0, empty = 0, mismatch = 0;
async function worker() {
  while (idx < dates.length) {
    const iso = dates[idx++];
    const draw = await dayFn(iso);
    if (!draw) { empty++; continue; }
    const dd = epochDay(iso) - db.dayBase;
    const pairs = [
      [draw.nums[0], 0], [draw.nums[1], 1], [draw.nums[2], 2],
      ...draw.specials.map((v) => [v, 3]), ...draw.cons.map((v) => [v, 4]),
    ];
    let any = false;
    for (const [num, tier] of pairs) {
      if (!/^\d{4}$/.test(num)) continue;
      const key = num + "|" + dd + "|" + gi + "|" + tier;
      if (have.has(key)) continue;
      have.add(key);
      (db.hits[num] = db.hits[num] || []).push([dd, gi, tier]);
      added++; any = true;
    }
    if (any) days++;
    await new Promise((r) => setTimeout(r, 120));   // be polite to the operator
  }
}

(async () => {
  console.log("game " + game + " (index " + gi + ", " + db.games[gi].name + ")  " + FROM + " .. " + TO + "  = " + dates.length + " days");
  await Promise.all([worker(), worker(), worker()]);
  const after = Object.values(db.hits).reduce((n, l) => n + l.length, 0);
  if (after < before) throw new Error("refusing to write: the database would shrink (" + before + " -> " + after + ")");
  fs.writeFileSync(DB_FILE, JSON.stringify(db), "utf8");
  console.log("  days with a draw : " + days);
  console.log("  days with nothing: " + empty);
  console.log("  records added    : " + added);
  console.log("  DB records       : " + before + " -> " + after);
})();