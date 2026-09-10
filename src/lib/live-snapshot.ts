/**
 * Server-side live snapshot: keeps a warm copy of every result card and of the
 * Perdana / Lucky HariHari draws so pages can render the CURRENT numbers in
 * their HTML (no waiting for the browser to fetch anything).
 */
export type PrizeSet = { prize: string[]; special: string[]; cons: string[]; date?: string; drawNo?: string };
export type HariEntry = { set: PrizeSet | null; six: { main: string; subs: Record<string, string> } | null; jp: Record<string, string> | null } | null;
export type Snapshot = {
  at: number;
  cards: Record<string, Record<string, string>>;
  perdana: Record<string, PrizeSet | null>;
  hari: Record<string, HariEntry>;
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
export const SNAPSHOT_TTL = 8000;

let cache: Snapshot | null = null;
let warming = false;
let warmer: ReturnType<typeof setInterval> | null = null;

async function get(url: string, json = false): Promise<any> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" }, cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    return json ? await res.json() : await res.text();
  } catch { return null; }
}

function clean(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

/** { "table-1": { first_prize: "2609", ... } } from a results page. */
function parseCards(html: string | null): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  if (!html) return out;
  const starts: { cls: string; i: number }[] = [];
  const re = /class="card outer-box (table-[0-9][^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) starts.push({ cls: m[1], i: m.index });
  for (let k = 0; k < starts.length; k++) {
    const seg = html.slice(starts[k].i, k + 1 < starts.length ? starts[k + 1].i : html.length);
    const vals: Record<string, string> = {};
    const elRe = /<(td|span|div)\b[^>]*data-id="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/gi;
    let e: RegExpExecArray | null;
    while ((e = elRe.exec(seg))) {
      const id = e[2];
      const val = clean(e[3]);
      if (id) vals[id] = val;
    }
    if (Object.keys(vals).length) out[starts[k].cls] = { ...(out[starts[k].cls] || {}), ...vals };
  }
  return out;
}

/** Singapore Pools official top-draw file -> { "table-11": { dataId: value } } */
function parseSingapore(html: string | null): Record<string, Record<string, string>> {
  if (!html) return {};
  const out: Record<string, string> = {};
  const liIdx = html.indexOf("<li");
  const li = liIdx >= 0 ? html.slice(liIdx, html.indexOf("</li>", liIdx) > 0 ? html.indexOf("</li>", liIdx) : html.length) : "";
  if (!li) return {};
  const monthNum: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
  const cell = (cls: string): string => {
    const m = new RegExp("class=['\"]" + cls + "['\"][^>]*>([\\s\\S]*?)<\\/", "i").exec(li);
    return m ? clean(m[1]) : "";
  };
  const drawDate = cell("drawDate");
  const dm = /([A-Za-z]{3}),\s*(\d{1,2})\s+([A-Za-z]{3}),?\s+(\d{4})/.exec(drawDate);
  if (dm) {
    const mo = monthNum[dm[3]];
    if (mo) out.date = weekdayOf(`${dm[4]}-${mo}-${dm[2].padStart(2, "0")}`);
  }
  const dn = /Draw No\.?\s*([0-9]+)/.exec(cell("drawNumber"));
  if (dn) out.draw_no = dn[1];
  const first = cell("tdFirstPrize"), second = cell("tdSecondPrize"), third = cell("tdThirdPrize");
  if (first) out.first_prize = first;
  if (second) out.second_prize = second;
  if (third) out.third_prize = third;
  const grabTable = (cls: string): string[] => {
    const m = new RegExp("class=['\"]" + cls + "['\"][\\s\\S]*?<\\/tbody>", "i").exec(li);
    if (!m) return [];
    return [...m[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((x) => clean(x[1])).filter(Boolean);
  };
  grabTable("tbodyStarterPrizes").slice(0, 10).forEach((v, i) => { out["special-" + (i + 1)] = v; });
  grabTable("tbodyConsolationPrizes").slice(0, 10).forEach((v, i) => { out["consolation-" + (i + 1)] = v; });
  return Object.keys(out).length > 3 ? { "table-11": out } : {};
}
/** live4d2u live feed -> the three East Malaysia cards (Sandakan / Cash Sweep / Sabah 88). */
function parseEastFeed(feed: any): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  if (!feed) return out;
  const map: Record<string, string> = { ST: "table-8", SW: "table-9", SB: "table-10" };
  for (const [key, cls] of Object.entries(map)) {
    const d = feed[key];
    if (!d) continue;
    const vals: Record<string, string> = {};
    if (d.DD) vals.date = String(d.DD);
    if (d.DN) vals.draw_no = String(d.DN);
    if (d.P1) vals.first_prize = String(d.P1);
    if (d.P2) vals.second_prize = String(d.P2);
    if (d.P3) vals.third_prize = String(d.P3);
    for (let i = 1; i <= 15; i++) { const v = d["S" + i]; if (v && v !== "-") vals["special-" + i] = String(v); }
    for (let i = 1; i <= 10; i++) { const v = d["C" + i]; if (v && v !== "-") vals["consolation-" + i] = String(v); }
    if (Object.keys(vals).length > 3) out[cls] = vals;
  }
  return out;
}

function myDate(offsetDays = 0): { iso: string; noPad: string } {
  const now = new Date(Date.now() + offsetDays * 86400000);
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).format(now).split("-");
  return { iso: `${y}-${m}-${d}`, noPad: `${y}-${Number(m)}-${Number(d)}` };
}

function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split("-");
  const dt = new Date(iso + "T12:00:00");
  const wk = isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US", { weekday: "short" });
  return `${d}-${m}-${y} (${wk})`;
}

const isDash = (v: string) => /^----+$/.test((v || "").trim()) || (v || "").trim() === "";

function textLines(html: string): string[] {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, "\n").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").split("\n").map((l) => l.trim());
}

function parsePerdana(html: string, iso: string): Record<string, PrizeSet> {
  const lines = textLines(html);
  const out: Record<string, PrizeSet> = {};
  const markers: number[] = [];
  lines.forEach((l, i) => { if (/^\d{8}4D$/.test(l) || /^\d{12}4D$/.test(l)) markers.push(i); });
  for (let mi = 0; mi < markers.length; mi++) {
    const start = markers[mi];
    const end = mi + 1 < markers.length ? markers[mi + 1] : lines.length;
    const block = lines.slice(start, end);
    const timeLine = block.slice(1, 10).find((l) => /^(\d{1,2}:\d{2})$/.test(l));
    if (!timeLine) continue;
    const pIdx = block.findIndex((l) => /^3rd Prize$/i.test(l));
    const sIdx = block.findIndex((l) => /^Special$/i.test(l));
    const cIdx = block.findIndex((l) => /^Consolation$/i.test(l));
    const eIdx = block.findIndex((l) => /^(2D|3D|6D) Results$/i.test(l));
    const grab = (from: number, to: number): string[] => {
      const vals: string[] = [];
      for (let i = from; i < to; i++) {
        const l = block[i]; if (!l) continue;
        const cmb = /^\([A-Z]\)\s*(----|\d{4})$/.exec(l);
        if (cmb) { vals.push(cmb[1]); continue; }
        if (/^(----|\d{4})$/.test(l)) { vals.push(l); continue; }
        if (/^\([A-Z]\)$/.test(l) && i + 1 < to) {
          const nv = /^(----|\d{4})$/.exec(block[i + 1]);
          if (nv) { vals.push(nv[1]); i++; }
        }
      }
      return vals;
    };
    const prize: string[] = [];
    if (pIdx >= 0 && sIdx > pIdx) {
      for (let i = pIdx + 1; i < sIdx && prize.length < 3; i++) {
        const cmb = /^\([A-Z]\)\s*(----|\d{4})$/.exec(block[i]);
        if (cmb) { prize.push(cmb[1]); continue; }
        if (/^(----|\d{4})$/.test(block[i])) { prize.push(block[i]); continue; }
      }
    }
    while (prize.length < 3) prize.unshift("----");
    const special = sIdx >= 0 ? grab(sIdx + 1, cIdx > sIdx ? cIdx : eIdx > sIdx ? eIdx : block.length) : [];
    const cons = cIdx >= 0 ? grab(cIdx + 1, eIdx > cIdx ? eIdx : block.length) : [];
    out[timeLine] = { prize, special, cons, date: weekdayOf(iso) };
  }
  return out;
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
const CONS = ["N", "O", "P", "Q", "R", "S", "T", "U", "V", "W"];

function hariSet(j: any, iso: string): PrizeSet | null {
  if (!j || !j.prize1) return null;
  return {
    prize: [j.prize1, j.prize2, j.prize3].map(String),
    special: LETTERS.map((L) => String(j["prize" + L] ?? "----")),
    cons: CONS.map((L) => String(j["prize" + L] ?? "----")),
    date: weekdayOf(iso),
    drawNo: j.id != null ? String(j.id) : undefined,
  };
}

function hariSix(j: any) {
  if (!j || !j.prize6D) return null;
  const subs: Record<string, string> = {};
  for (const k of ["2A", "2B", "3A", "3B", "4A", "4B", "5A", "5B"]) subs["six_" + k.toLowerCase()] = String(j["prize6D_" + k] ?? "----");
  return { main: String(j.prize6D), subs };
}

async function hariFor(time: string, iso: string, noPad: string): Promise<HariEntry> {
  const j = await get(`https://api.hari4d.com/DrawResultL/GetDrawResult?date=${noPad}T${time}:00`, true);
  const set = hariSet(j, iso);
  if (!set || !set.prize.some((v) => !isDash(v))) return null;
  const jpRaw = await get(`https://api.hari4d.com/Jackpot/GetJackpot?date=${noPad}T${time}:00`, true);
  let jp: Record<string, string> | null = null;
  if (jpRaw && jpRaw.jackpotAmount != null) {
    jp = { jp_pool: "USD " + Number(jpRaw.jackpotAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) };
    const nums: string[] = [];
    if (jpRaw.number) nums.push(String(jpRaw.number));
    if (jpRaw.number2) nums.push(String(jpRaw.number2));
    if (nums.length) jp.jp_no = nums.join(" or ");
  }
  return { set, six: hariSix(j), jp };
}

/** Build a fresh snapshot (parallel upstream fetches). */
export async function buildSnapshot(): Promise<Snapshot> {
  const today = myDate(0);
  const yest = myDate(-1);
  const [home, east, sg, feed, perToday, perYest, h15, h19, h15y, h19y] = await Promise.all([
    get("https://live4dresult.net/"),
    get("https://live4dresult.net/sabah-sarawak-4d-results/"),
    get("https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/fourd_result_top_draws_en.html?ts=" + Date.now()),
    get("https://www.live4d2u.net/liveosx.json?ts=" + Date.now(), true),
    get(`https://www.perdana4d.com/Results/4D?processDate=${today.iso}`),
    get(`https://www.perdana4d.com/Results/4D?processDate=${yest.iso}`),
    hariFor("15:30", today.iso, today.noPad),
    hariFor("19:30", today.iso, today.noPad),
    hariFor("15:30", yest.iso, yest.noPad),
    hariFor("19:30", yest.iso, yest.noPad),
  ]);

  // East Malaysia: prefer the live feed (it publishes the newest draw first),
  // then the live4dresult page, then the Singapore / home sources.
  const cards = { ...parseCards(east), ...parseEastFeed(feed), ...parseSingapore(sg), ...parseCards(home) };

  const perdana: Record<string, PrizeSet | null> = { "15:30": null, "19:30": null };
  for (const [html, d] of [[perToday, today], [perYest, yest]] as [string | null, { iso: string; noPad: string }][]) {
    if (!html) continue;
    const sets = parsePerdana(html, d.iso);
    for (const time of ["15:30", "19:30"]) {
      const s = sets[time];
      if (s && s.prize.some((v) => !isDash(v)) && !perdana[time]) perdana[time] = s;
    }
  }

  const snap: Snapshot = { at: Date.now(), cards, perdana, hari: { "15:30": h15 || h15y, "19:30": h19 || h19y } };
  cache = snap;
  return snap;
}

/** Cached snapshot (rebuilt at most every SNAPSHOT_TTL). */
export async function getSnapshot(): Promise<Snapshot> {
  startWarmer();
  if (cache && Date.now() - cache.at < SNAPSHOT_TTL) return cache;
  if (warming && cache) return cache;
  warming = true;
  try { return await buildSnapshot(); } finally { warming = false; }
}

export function startWarmer() {
  if (warmer) return;
  warmer = setInterval(() => { void buildSnapshot().catch(() => {}); }, SNAPSHOT_TTL);
  (warmer as unknown as { unref?: () => void }).unref?.();
}




