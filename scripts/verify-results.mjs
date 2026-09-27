// Cross-check what the app is showing against independent sources.
//
// This is the safety net: instead of a person noticing a wrong number, this
// compares every game's displayed result with another source. The scheduled
// job opens an issue (that sends an email) and fails red when something is
// wrong, so nobody has to sit and watch the app by hand.
//
//   node scripts/verify-results.mjs
//
// A game is only judged when BOTH sides name the same draw day and both have
// their main prizes. While a draw is still being published the app is allowed
// to be a little behind - it is never allowed to be wrong.
import fs from "node:fs";

const APP = "https://mkt88-my.vercel.app";
const OUT = "data/verification.json";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const get = async (url, json = false) => {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "*/*", "Accept-Encoding": "identity" },
    signal: AbortSignal.timeout(45000),
  });
  if (!r.ok) throw new Error("upstream " + r.status + " for " + url);
  return json ? await r.json() : await r.text();
};
// Some hosts only answer GitHub's servers through the app's own relay.
const viaProxy = (url, json = false) => get(APP + "/api/live?u=" + encodeURIComponent(url), json);
const getAny = async (url, json = false) => {
  try { return await get(url, json); } catch { return await viaProxy(url, json); }
};

const four = (v) => (/^\d{4}$/.test(String(v ?? "").trim()) ? String(v).trim() : "");
const trio = (a) => a.map(four).join("/");
const hasMain = (nums) => /\d{4}\/\d{4}\/\d{4}/.test(String(nums || ""));
const dayOf = (s) => {
  const m = /(\d{2})-(\d{2})-(\d{4})/.exec(String(s || ""));
  return m ? m[3] + m[2] + m[1] : "";
};
const MONTH = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

const sgt = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (t) => parts.find((x) => x.type === t).value;
  return { day: `${g("year")}${g("month")}${g("day")}`, hour: Number(g("hour")) };
};
const NOW = sgt();
// Every draw of the day is finished and published by 21:00 Malaysia time.
const closed = (day) => !!day && (day < NOW.day || (day === NOW.day && NOW.hour >= 21));

const notes = [];
const home = await get(APP + "/api/home-live", true).then((j) => j.cards || {});
const cam = await get(APP + "/api/cambodia-live", true).catch(() => ({}));
let feed = {};
try {
  feed = await viaProxy("https://www.live4d2u.net/liveosx.json?ts=" + Date.now(), true);
} catch (e) {
  notes.push("live4d2u feed unreachable: " + e.message);
}

// Official Singapore Pools (the authority for Singapore).
let sgOfficial = null;
try {
  const html = await getAny("https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/fourd_result_top_draws_en.html?v=" + Date.now());
  const txt = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ");
  const m = /([A-Z][a-z]{2}),\s*(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{4})[\s\S]{0,80}?1st Prize\s*(\d{4})[\s\S]{0,60}?2nd Prize\s*(\d{4})[\s\S]{0,60}?3rd Prize\s*(\d{4})/.exec(txt);
  if (m) sgOfficial = { date: m[2].padStart(2, "0") + "-" + MONTH[m[3]] + "-" + m[4], nums: trio([m[5], m[6], m[7]]) };
} catch (e) {
  notes.push("singaporepools unreachable: " + e.message);
}

// Official Nine Lotto.
let nineOfficial = null;
try {
  const html = await getAny("https://9lotto.com/result");
  const grab = (id) => { const m = new RegExp('id="' + id + '"[^>]*>([^<]{0,12})<').exec(html); return m ? m[1].trim() : ""; };
  // The page names its own draw date in the date box, so numbers can never be
  // filed under the wrong day.
  const ph = /id="inputDate"[^>]*placeholder="([^"]+)"/.exec(html);
  const d = ph ? ph[1] : "";
  nineOfficial = {
    date: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.slice(8, 10) + "-" + d.slice(5, 7) + "-" + d.slice(0, 4) : "",
    nums: trio([grab("n1"), grab("n2"), grab("n3")]),
  };
} catch (e) {
  notes.push("9lotto unreachable: " + e.message);
}

// The 3:30pm and 7:30pm Perdana/HariHari draws are separate. The third-party
// feed carries whichever finished last, so compare it with the newest slot the
// app holds - otherwise a not-yet-drawn 7:30pm looks like a wrong result.
const newestSlot = (slots) => {
  let best = null;
  for (const v of Object.values(slots || {})) {
    const s = v && v.set ? v.set : v;
    if (!s || !s.date) continue;
    if (!best || dayOf(s.date) > dayOf(best.date)) best = s;
  }
  return best || {};
};

// Official HariHari: the operator's own API is the authority for 3:30pm/7:30pm.
let hariOfficial = null;
const isoDay = NOW.day.slice(0, 4) + "-" + NOW.day.slice(4, 6) + "-" + NOW.day.slice(6, 8);
for (const t of ["19:30", "15:30"]) {
  try {
    const j = await getAny("https://api.hari4d.com/DrawResultL/GetDrawResult?date=" + isoDay + "T" + t + ":00", true);
    if (j && /^\d{4}$/.test(String(j.prize1 || ""))) {
      hariOfficial = { date: isoDay.slice(8, 10) + "-" + isoDay.slice(5, 7) + "-" + isoDay.slice(0, 4), nums: trio([j.prize1, j.prize2, j.prize3]), time: t };
      break;
    }
  } catch { /* fall back to the shared feed */ }
}

// Official Perdana 4D. It answers slowly, so a failure just falls back to the
// shared feed below.
let perOfficial = null;
try {
  const html = await getAny("https://www.perdana4d.com/Results/4D?processDate=" + isoDay);
  const t = html.replace(/<[^>]+>/g, "|").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").replace(/(\|\s*)+/g, "|");
  for (const time of ["19:30", "15:30"]) {
    const i = t.indexOf(time + "|1st Prize");
    if (i < 0) continue;
    const m = /1st Prize\|2nd Prize\|3rd Prize\|(?:\([A-Z]\)\s*)?(\d{4})\s*\|(?:\([A-Z]\)\s*)?(\d{4})\s*\|(?:\([A-Z]\)\s*)?(\d{4})\s*\|/.exec(t.slice(i, i + 300));
    if (m) {
      perOfficial = { date: isoDay.slice(8, 10) + "-" + isoDay.slice(5, 7) + "-" + isoDay.slice(0, 4), nums: trio([m[1], m[2], m[3]]), time };
      break;
    }
  }
} catch (e) {
  notes.push("perdana4d unreachable: " + e.message);
}

const card = (cls) => home[cls] || {};
const appFour = (c) => trio([c.first_prize, c.second_prize, c.third_prize]);
const feedFour = (k) => trio([(feed[k] || {}).P1, (feed[k] || {}).P2, (feed[k] || {}).P3]);
const feedDay = (k) => (feed[k] || {}).DD || "";
const perSlot = newestSlot(cam.perdana);
const hariSlot = newestSlot(cam.hari);

const rows = [];
const judge = (game, appDate, appNums, refDate, refNums, source) => {
  const appDay = dayOf(appDate);
  const refDay = dayOf(refDate);
  let state;
  if (!hasMain(appNums)) state = hasMain(refNums) && closed(refDay) ? "no-result" : "waiting-app";
  else if (!hasMain(refNums) || !refDay) state = "waiting-source";
  else if (appDay !== refDay) state = appDay > refDay ? "ahead" : "behind";
  else state = appNums === refNums ? "match" : "mismatch";
  rows.push({ game, appDate, appNums, refDate, refNums, source, state });
};

judge("Magnum", card("table-1").date, appFour(card("table-1")), feedDay("M"), feedFour("M"), "live4d2u");
judge("Da Ma Cai", card("table-4").date, appFour(card("table-4")), feedDay("D"), feedFour("D"), "live4d2u");
judge("Sports Toto", card("table-6").date, appFour(card("table-6")), feedDay("T"), feedFour("T"), "live4d2u");
judge("Sandakan", card("table-8").date, appFour(card("table-8")), feedDay("ST"), feedFour("ST"), "live4d2u");
judge("Cash Sweep", card("table-9").date, appFour(card("table-9")), feedDay("SW"), feedFour("SW"), "live4d2u");
judge("Sabah 88", card("table-10").date, appFour(card("table-10")), feedDay("SB"), feedFour("SB"), "live4d2u");
judge("Grand Dragon", card("table-13").date, appFour(card("table-13")), feedDay("G"), feedFour("G"), "live4d2u");
judge("Perdana", perSlot.date || "", trio(perSlot.prize || []), perOfficial ? perOfficial.date : feedDay("P"), perOfficial ? perOfficial.nums : feedFour("P"), perOfficial ? "perdana4d.com (official)" : "live4d2u");
judge("HariHari", hariSlot.date || "", trio(hariSlot.prize || []), hariOfficial ? hariOfficial.date : feedDay("H"), hariOfficial ? hariOfficial.nums : feedFour("H"), hariOfficial ? "hari4d.com (official)" : "live4d2u");
judge("Singapore", card("table-11").date, appFour(card("table-11")), sgOfficial ? sgOfficial.date : feedDay("S"), sgOfficial ? sgOfficial.nums : feedFour("S"), sgOfficial ? "singaporepools (official)" : "live4d2u");
judge("Nine Lotto", card("table-17").date, appFour(card("table-17")), nineOfficial ? nineOfficial.date : "", nineOfficial ? nineOfficial.nums : "", "9lotto (official)");

const isBad = (r) => r.state === "mismatch" || ((r.state === "behind" || r.state === "no-result") && closed(dayOf(r.refDate)));
const bad = rows.filter(isBad);

const report = { checkedAt: new Date().toISOString(), sgt: NOW, notes, rows, problems: bad };
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));

const line = (r) => "| " + [r.game, r.appDate || "-", r.appNums || "-", r.refDate || "-", r.refNums || "-", r.source, r.state].join(" | ") + " |";
console.log("| game | app date | app | source date | source | source | verdict |");
console.log("| --- | --- | --- | --- | --- | --- | --- |");
for (const r of rows) console.log(line(r));
for (const n of notes) console.log("note: " + n);

if (bad.length) {
  console.log("");
  console.log(bad.length + " PROBLEM(S):");
  for (const r of bad) {
    console.log("  " + r.game + ": " + (r.state === "mismatch"
      ? "app shows " + r.appNums + " for " + r.appDate + " but " + r.source + " says " + r.refNums
      : "app has no complete result for " + r.refDate + " but " + r.source + " does"));
  }
  process.exit(1);
}
console.log("");
console.log(rows.filter((r) => r.state === "match").length + " of " + rows.length + " games cross-checked and agreeing");
