/**
 * Source race: who publishes each game's new draw FIRST?
 *
 * Polls the official operator feed and the mirror side by side, every few
 * seconds, and records the moment each one first moves off the pre-draw value.
 * Read-only: it fetches public pages and prints what it saw. It changes nothing.
 *
 *   node scripts/source-race.mjs --minutes 45
 *
 * Run it inside a live draw window - outside one, nothing changes and the
 * table says so.
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };
const MINUTES = argOf("--minutes", 45);
const EVERY_MS = argOf("--every", 5000);

/** Find the first value for `key` anywhere in a parsed object (feeds nest differently). */
function pick(obj, key) {
  const q = [obj];
  let guard = 0;
  while (q.length && guard++ < 500) {
    const cur = q.shift();
    if (!cur || typeof cur !== "object") continue;
    if (!Array.isArray(cur) && key in cur) return cur[key];
    for (const v of Object.values(cur)) if (v && typeof v === "object") q.push(v);
  }
  return undefined;
}
const clean = (v) => { const s = String(v ?? "").trim(); return !s || /^----+$/.test(s) ? "" : s; };
const now = () => new Date().toISOString().slice(11, 19);

async function json(url, ms = 8000) {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json,text/plain,*/*", referer: "https://www.magnum4d.my/" }, signal: AbortSignal.timeout(ms), cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
async function text(url, ms = 10000) {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,*/*" }, signal: AbortSignal.timeout(ms), cache: "no-store" });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

/** mirror live4d2u: key -> P1 (1st prize), DD (draw date) */
async function fromMirror() {
  const j = await json("https://www.live4d2u.net/liveosx.json?ts=" + Date.now());
  const out = {};
  if (!j) return out;
  for (const [key, label] of Object.entries({ M: "Magnum", D: "DaMaCai", T: "SportsToto", S: "Singapore", ST: "Sandakan", SW: "CashSweep", SB: "Sabah88", G: "GrandDragon" })) {
    const d = j[key];
    if (!d) continue;
    out[label] = { value: clean(d.P1), extra: "date " + (clean(d.DD) || "-") };
  }
  return out;
}

/** Magnum's own live JSON. 1st prize = the S-number named by the T1 letter. */
async function fromMagnum() {
  const j = await json("https://www.magnum4d.my/live-draw");
  const r = j?.Data?.Results;
  if (!r) return {};
  const letter = clean(r.T1).toUpperCase();
  const idx = letter ? letter.charCodeAt(0) - 64 : 0;
  const val = idx >= 1 && idx <= 13 ? clean(r["S" + String(idx).padStart(2, "0")]) : "";
  return { Magnum: { value: val, extra: "date " + (clean(r.DrawDate) || "-") } };
}

/** Da Ma Cai publishes its own DrawResult.json (the file livedraw.damacai.com.my reads). */
async function fromDamacai() {
  const j = await json("https://prddmcremt1.blob.core.windows.net/drawresult/DrawResult.json?st=2018-05-24T09%3A54%3A31Z&se=2028-05-25T09%3A54%3A00Z&sp=rl&sv=2017-07-29&sr=b&sig=inT8KHVV3QpYI7e7X0ZQ%2BNX%2BlboBg%2Fs%2FX9GTfUhfRGo%3D");
  if (!j) return {};
  return { DaMaCai: { value: clean(pick(j, "p1")), extra: "draw " + (clean(pick(j, "drawNo") ?? pick(j, "drawDate")) || "-") } };
}

/**
 * Sabah 88 - the operator's own site is diriwan88.com (title "Welcome to Sabah
 * 88"). Its first 4D result link carries the 1st prize:
 *   <a class=result href="/App88/Result/4DSearch.asp?DrawType=L4&Number=9444"><b>9444</b></a>
 *
 * NOTE: the app currently reads sabah88.net instead, whose title is
 * "Sabah88 沙巴88成绩网 4D、3D、Lotto 开奖成绩" - that is a results aggregator, i.e.
 * a third party, not the operator. Both are watched here so the race shows
 * which publishes first.
 */
async function fromSabah88Operator() {
  const html = await text("https://www.diriwan88.com/cms/");
  if (!html) return {};
  const m = /href="\/App88\/Result\/4DSearch\.asp\?DrawType=L4&Number=(\d{4})"/i.exec(html);
  if (!m) return {};
  return { Sabah88: { value: clean(m[1]), extra: "diriwan88.com" } };
}

/** The aggregator the app reads today: window.SABAH88_INITIAL on sabah88.net. */
async function fromSabah88Aggregator() {
  const html = await text("https://www.sabah88.net/");
  if (!html) return {};
  const m = /window\.SABAH88_INITIAL\s*=\s*(\{[\s\S]*?\})\s*;/.exec(html);
  if (!m) return {};
  try {
    const o = JSON.parse(m[1]);
    const d = o.draw ?? o.data ?? o;
    return { Sabah88: { value: clean(d.n1), extra: "sabah88.net (aggregator)" } };
  } catch { return {}; }
}
/**
 * Grand Dragon official. The app points at gdlotto.net, which is DEAD (both the
 * site and /results/ajax/_result.aspx fail to connect - checked 10 Oct 2026).
 * The operator's real domain is gdlotto.com, and the very same ajax path works
 * there: id="1stPz" carries the 1st prize (8526 on 10-10-2026).
 */
function gdDate() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "numeric", day: "numeric" }).format(new Date()).split("-");
  return Number(p[1]) + "/" + Number(p[2]) + "/" + p[0];
}
async function fromGrandDragon() {
  const url = "https://www.gdlotto.com/results/ajax/_result.aspx?past=1&v=1&d=" + gdDate();
  const html = await text(url, 12000);
  if (!html) return {};
  const cell = (id) => {
    const m = new RegExp('id="' + id + '"[^>]*>([\\s\\S]{0,200}?)<', "i").exec(html);
    if (!m) return "";
    return clean((/\d{4}/.exec(m[1]) || [""])[0]);
  };
  const v = cell("1stPz");
  if (!v) return {};
  return { GrandDragon: { value: v, extra: "gdlotto.com " + gdDate() } };
}
const SOURCES = [
  { name: "mirror live4d2u", fn: fromMirror },
  { name: "Magnum official live-draw", fn: fromMagnum },
  { name: "Da Ma Cai official JSON", fn: fromDamacai },
  { name: "Grand Dragon OPERATOR (gdlotto.com)", fn: fromGrandDragon },
  { name: "Sabah 88 OPERATOR (diriwan88)", fn: fromSabah88Operator },
  { name: "Sabah 88 aggregator (sabah88.net)", fn: fromSabah88Aggregator },
];

(async () => {
  const state = new Map();   // "game|source" -> { base, first, at }
  const seen = new Set();

  const tick = async () => {
    for (const s of SOURCES) {
      let res = {};
      try { res = await s.fn(); } catch { res = {}; }
      for (const [game, info] of Object.entries(res)) {
        if (!info || !info.value) continue;
        const k = game + "|" + s.name;
        if (!seen.has(k)) { seen.add(k); state.set(k, { base: info.value, first: null, at: null, extra: info.extra }); continue; }
        const st = state.get(k);
        if (st.first === null && info.value !== st.base) { st.first = info.value; st.at = now(); st.extra = info.extra; }
      }
    }
  };

  const end = Date.now() + MINUTES * 60000;
  console.log("Source race - " + MINUTES + " minutes, polling every " + (EVERY_MS / 1000) + "s");
  console.log("Started " + new Date().toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur" }) + " (Malaysia)\n");

  let round = 0;
  while (Date.now() < end) {
    round++;
    await tick();
    if (round % 12 === 0) console.log("  ... still watching (" + now() + " UTC)");
    await new Promise((r) => setTimeout(r, EVERY_MS));
  }

  console.log("\n================ RESULT: who published first ================");
  const games = [...new Set([...state.keys()].map((k) => k.split("|")[0]))].sort();
  for (const g of games) {
    console.log("\n" + g);
    const rows = [...state.entries()].filter(([k]) => k.split("|")[0] === g)
      .map(([k, v]) => ({ src: k.split("|")[1], ...v }))
      .sort((a, b) => (a.at || "zzz").localeCompare(b.at || "zzz"));
    for (const r of rows) {
      const when = r.at ? r.at + " UTC" : "(no change during the run)";
      console.log("   " + r.src.padEnd(30) + " -> " + (r.first || r.base) + "  first seen: " + when);
    }
    const changed = rows.filter((r) => r.at);
    if (changed.length >= 2) {
      const gap = Math.round((new Date("1970-01-01T" + changed[1].at + ".000Z") - new Date("1970-01-01T" + changed[0].at + ".000Z")) / 1000);
      console.log("   >> " + changed[0].src + " was first, by " + gap + "s");
    } else if (changed.length === 1) {
      console.log("   >> only " + changed[0].src + " published during the run");
    } else {
      console.log("   >> neither source changed (no draw in this window, or the run was too early)");
    }
  }
  console.log("\nRead-only run. Nothing was changed.");
})();
