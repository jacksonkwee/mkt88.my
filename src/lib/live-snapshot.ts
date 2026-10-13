import perdanaOfficial from "./perdana-official.json";
import sgLiveCapture from "../../data/sg-live.json";
/**
 * Server-side live snapshot: keeps a warm copy of every result card and of the
 * Perdana / Lucky HariHari draws so pages can render the CURRENT numbers in
 * their HTML (no waiting for the browser to fetch anything).
 */
export type PrizeSet = { prize: string[]; special: string[]; cons: string[]; date?: string; drawNo?: string; from?: string[] };
export type HariEntry = { set: PrizeSet | null; six: { main: string; subs: Record<string, string> } | null; jp: Record<string, string> | null } | null;
export type SixEntry = { main: string; subs: Record<string, string>; date?: string } | null;
export type Snapshot = {
  at: number;
  cards: Record<string, Record<string, string>>;
  perdana: Record<string, PrizeSet | null>;
  hari: Record<string, HariEntry>;
  gd6: SixEntry;
  gdjp7: Record<string, string> | null;
  nine6: SixEntry;
  nineJp: Record<string, string> | null;
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
export const SNAPSHOT_TTL = 4000;

/**
 * How old a copy may be before we refuse to show it on a live draw.
 *
 * The snapshot is kept per serverless instance and Vercel runs several, so a
 * request that lands on a cold one used to be handed its old copy - measured
 * at 29 to 33 seconds old - which is what made a live number arrive half a
 * minute after the other app had it. Past this age we wait for a fresh build
 * instead: a slightly slower page is better than a wrong-looking result.
 */
const MAX_STALE_MS = 5000;

/**
 * How old a copy may be before a POLLING request stops being answered from
 * cache.
 *
 * The phone polls these endpoints every couple of seconds during a draw, and it
 * used to be handed whatever the instance had for up to MAX_STALE_MS - measured
 * at 4 to 6 seconds old, which is most of the gap the other 4D apps were beating
 * us by. Past this age the request now waits for the rebuild instead, so what
 * reaches the phone is at most this old plus the build itself.
 *
 * Page renders are deliberately NOT held to this: they still take whatever is
 * cached so the app keeps opening instantly, then correct themselves on the
 * first poll a moment later.
 */
const FRESH_MS = 2500;

let cache: Snapshot | null = null;
let warming = false;
let inflight: Promise<Snapshot> | null = null;
let warmer: ReturnType<typeof setInterval> | null = null;

/**
 * One rebuild at a time. Several phones can poll in the same second, and each
 * one used to fire its own sweep of ~13 upstream pages. They now share a single
 * build, which is what makes the shorter freshness window affordable.
 */
function rebuildOnce(): Promise<Snapshot> {
  if (!inflight) {
    warming = true;
    inflight = buildSnapshot().finally(() => { inflight = null; warming = false; });
  }
  return inflight;
}

/*
 * Every source is fetched on a SHORT leash.
 *
 * These used to default to a 12s timeout plus one retry, so a single site having
 * a slow moment could hold the whole snapshot build open for up to ~24 seconds.
 * buildSnapshot() only publishes once Promise.all has settled, so ONE sluggish
 * source delayed all eleven games - which is why the app ran so far behind other
 * 4D apps during a draw even though its own pipeline measured well (reported
 * 3 Oct 2026).
 *
 * 4s with no retry: the sources normally answer in well under a second, so this
 * is generous. Anything slower is skipped for this cycle and picked up on the
 * next one - the "a blank never replaces a known number" rule below stops that
 * from wiping a card that already has its numbers.
 */
async function get(url: string, json = false, timeoutMs = 4000, retries = 0): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" }, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error("upstream " + res.status);
      return json ? await res.json() : await res.text();
    } catch {
      if (attempt < retries) await new Promise((r) => setTimeout(r, 250));
    }
  }
  return null;
}

function clean(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

/** An amount the operators print, as "RM 1,234.56"; null when there is none. */
function moneyOf(v: unknown): string | null {
  const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return "RM " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    /*
     * Any element, not just td/span/div.
     *
     * The mirror prints the Magnum jackpot amounts as
     * <b data-id="first_jackpot_prize">RM ...</b>, and a tag list that stopped
     * at div/span/td never picked them up - so the card kept the amount that was
     * captured months earlier and never matched the operator (reported
     * 10 Oct 2026 for Magnum 4D Jackpot 1 and 2, and Da Ma Cai 3+3D).
     */
    const elRe = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*data-id="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/gi;
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

/** Singapore Pools uses its own version token; a generic ts query can hit a stale CDN copy. */
function singaporeArchiveVersion(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric", month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "0";
  return get("year") + "y" + Number(get("month")) + "d" + Number(get("day")) + "h" + Number(get("hour")) + "m" + get("minute");
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
/** live4d2u live feed -> the primary 4D cards. Explicit "----" placeholders
 *  replace stale values when a new draw is being revealed one number at a time. */
function parseLiveFeed(feed: any): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  if (!feed) return out;
  const map: Record<string, string> = {
    M: "table-1", D: "table-4", T: "table-6", S: "table-11",
    ST: "table-8", SW: "table-9", SB: "table-10", G: "table-13",
  };
  for (const [key, cls] of Object.entries(map)) {
    const d = feed[key];
    if (!d) continue;
    const vals: Record<string, string> = {};
    vals.date = d.DD ? String(d.DD) : "----";
    vals.draw_no = d.DN ? String(d.DN) : "----";
    for (const [src, dest] of [["P1", "first_prize"], ["P2", "second_prize"], ["P3", "third_prize"]] as const) {
      const v = d[src];
      vals[dest] = v && v !== "-" ? String(v) : "----";
    }
    for (let i = 1; i <= 15; i++) {
      const v = d["S" + i];
      vals["special-" + i] = v && v !== "-" ? String(v) : "----";
    }
    for (let i = 1; i <= 10; i++) {
      const v = d["C" + i];
      vals["consolation-" + i] = v && v !== "-" ? String(v) : "----";
    }
    out[cls] = vals;
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

/**
 * A draw can be published number by number. As long as ANY number is out we
 * show that draw (with "----" for the rest) instead of falling back to the
 * previous day - this is what the live-result apps do.
 */
const hasAnyNumber = (set: PrizeSet | null | undefined): boolean =>
  !!set && [...set.prize, ...set.special, ...set.cons].some((v) => !isDash(v));

function textLines(html: string): string[] {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, "\n").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").split("\n").map((l) => l.trim());
}

/**
 * Perdana 4D from the operator's own page.
 *
 * The page carries one block per draw, each introduced by a marker such as
 * 2026092115004D. The values live in classes and attributes -
 * 4dFirst / 4dSecond / 4dThird and fourDPosition="SpecialA".."ConsolationW" -
 * not in the printed label order. Reading the labels instead (what this used
 * to do) found nothing, so the live Perdana numbers never reached the app and
 * its page showed only an old stored card.
 */
function parsePerdana(html: string, iso: string): Record<string, PrizeSet> {
  const out: Record<string, PrizeSet> = {};
  // Shape 1: the raw page. Values sit in 4dFirst / 4dSecond / 4dThird and
  // fourDPosition="SpecialA".."ConsolationW" attributes.
  if (/4dFirst/.test(html)) {
    for (const block of html.split(/(?=\d{12}4D|\d{8}4D)/).slice(1)) {
      const time = (block.match(/>(\d{1,2}:\d{2})</) || [])[1];
      if (!time) continue;
      const val = (re: RegExp): string => { const m = re.exec(block); return m && m[1] ? m[1] : "----"; };
      const cell = (cls: string) => val(new RegExp('class="[^"]*' + cls + '"[^>]*>\\s*(?:\\([A-Z]\\)\\s*)?(----|\\d{4})'));
      // The operator prints which special each prize came from: "(E) 9530".
      const cellLetter = (cls: string) => {
        const m = new RegExp('class="[^"]*' + cls + '"[^>]*>\\s*\\(([A-Z])\\)').exec(block);
        return m ? m[1] : "";
      };
      const byPos = (letters: string) =>
        [...letters].map((L) => val(new RegExp('fourDPosition="[^"]*' + L + '"[^>]*>\\s*(?:\\([A-Z]\\)\\s*)?(----|\\d{4})')));
      const set: PrizeSet = {
        prize: [cell("4dFirst"), cell("4dSecond"), cell("4dThird")],
        special: byPos("ABCDEFGHIJKLM"),
        cons: byPos("NOPQRSTUVW"),
        from: [cellLetter("4dFirst"), cellLetter("4dSecond"), cellLetter("4dThird")],
        date: weekdayOf(iso),
      };
      if (hasAnyNumber(set) && !out[time]) out[time] = set;
    }
    return out;
  }
  // Shape 2: the same page as plain text, which is how it arrives when it has
  // to be read through a text reader because the host cannot open it directly.
  const lines = html.split(/\r?\n/).map((l) => l.trim());
  const marks: number[] = [];
  lines.forEach((l, i) => { if (/^\d{8}4D$/.test(l) || /^\d{12}4D$/.test(l)) marks.push(i); });
  const VALUE = /^(?:\([A-Z]\)\s*)?(----|\d{4})$/;
  for (let m = 0; m < marks.length; m++) {
    const start = marks[m];
    const end = m + 1 < marks.length ? marks[m + 1] : lines.length;
    const block = lines.slice(start, end);
    const dm = /^(\d{4})(\d{2})(\d{2})/.exec(block[0] || "");
    const drawIso = dm ? dm[1] + "-" + dm[2] + "-" + dm[3] : iso;
    const time = block.slice(1, 8).find((l) => /^\d{1,2}:\d{2}$/.test(l));
    if (!time) continue;
    const at = (re: RegExp) => block.findIndex((l) => re.test(l));
    const pIdx = at(/^3rd Prize$/i);
    const sIdx = at(/^Special$/i);
    const cIdx = at(/^Consolation$/i);
    const grab = (from: number, to: number, max: number): string[] => {
      const vals: string[] = [];
      for (let i = from; i < to && vals.length < max; i++) {
        const mm = VALUE.exec(block[i]);
        if (mm) vals.push(mm[1]);
      }
      return vals;
    };
    // The operator prints which special each prize came from, on its own line
    // ("(E)") or joined to the number ("(E) 9530").
    const prize: string[] = [];
    const from: string[] = [];
    if (pIdx >= 0 && sIdx > pIdx) {
      for (let i = pIdx + 1; i < sIdx && prize.length < 3; i++) {
        const l = block[i];
        if (!l) continue;
        const cmb = /^\(([A-Z])\)\s*(----|\d{4})$/.exec(l);
        if (cmb) { from.push(cmb[1]); prize.push(cmb[2]); continue; }
        if (/^----$/.test(l)) { from.push(""); prize.push(l); continue; }
        const letterOnly = /^\(([A-Z])\)$/.exec(l);
        if (letterOnly && i + 1 < sIdx && /^(----|\d{4})$/.test(block[i + 1])) {
          from.push(letterOnly[1]);
          prize.push(block[i + 1]);
          i++;
        }
      }
    }
    while (prize.length < 3) { prize.push("----"); from.push(""); }
    while (from.length < 3) from.push("");
    const special = sIdx >= 0 ? grab(sIdx + 1, cIdx > sIdx ? cIdx : block.length, 13) : [];
    while (special.length < 13) special.push("----");
    const cons = cIdx >= 0 ? grab(cIdx + 1, block.length, 10) : [];
    while (cons.length < 10) cons.push("----");
    const set: PrizeSet = { prize, special, cons, from, date: weekdayOf(drawIso) };
    if (hasAnyNumber(set) && !out[time]) out[time] = set;
  }
  return out;
}

/** "20-09-2026 (Sun)" -> "2026-09-20". */
function isoFromDateLabel(s: string): string | null {
  const m = /(\d{2})-(\d{2})-(\d{4})/.exec(s || "");
  return m ? m[3] + "-" + m[2] + "-" + m[1] : null;
}

/**
 * Perdana 4D from the shared live feed.
 *
 * The operator's own page cannot be reached from the server (it times out) and
 * refuses cross-origin reads from the phone, so that source is unusable. This
 * feed is the one every other game already uses and it carries Perdana under
 * its P entry.
 *
 * It holds ONE draw with no time on it, and the card always carries the feed's
 * own date, never a date borrowed from somewhere else.
 *
 * Which session it belongs to is worked out from the clock: before 7:30PM the
 * newest draw the feed can be carrying is that day's 3:30PM one, after 7:30PM it
 * is the 7:30PM one. Filing every value under 7:30PM - which was right while the
 * 3:30PM draw was suspended - put today's 3:30PM result on the 7:30PM card and
 * pre-announced tonight's 7:30PM reminder (12 Oct 2026).
 */
function perdanaFromFeed(feed: unknown): Record<string, PrizeSet | null> {
  const my = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const mins = my.getUTCHours() * 60 + my.getUTCMinutes();
  const slot = mins >= 19 * 60 + 30 ? "19:30" : "15:30";
  const out: Record<string, PrizeSet | null> = { [slot]: null };
  const p = (feed as { P?: Record<string, unknown> } | null)?.P;
  if (!p) return out;
  const val = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return !s || s === "-" ? "----" : s;
  };
  const prize = [val(p.P1), val(p.P2), val(p.P3)];
  if (!prize.some((v) => !isDash(v))) return out;
  const special = Array.from({ length: 13 }, (_, i) => val(p["S" + (i + 1)]));
  const cons = Array.from({ length: 10 }, (_, i) => val(p["C" + (i + 1)]));
  const dd = typeof p.DD === "string" ? p.DD : "";
  const iso = isoFromDateLabel(dd);
  out[slot] = { prize, special, cons, date: iso ? weekdayOf(iso) : dd };
  return out;
}
/**
 * The official Perdana page through a text reader.
 *
 * perdana4d.com times out from this host and refuses cross-origin reads from
 * the phone, so the official page is read through a public reader instead.
 * Throttled: the snapshot rebuilds constantly and this is a shared service.
 */
const PERDANA_RELAY = "https://r.jina.ai/";
let perdanaRelayAt = 0;
async function perdanaFromRelay(iso: string): Promise<Record<string, PrizeSet>> {
  if (Date.now() - perdanaRelayAt < 5 * 60 * 1000) return {};
  perdanaRelayAt = Date.now();
  // Its own request: a reader round trip is slower than the 12s the shared
  // helper allows, and that limit is why this came back empty.
  try {
    const res = await fetch(PERDANA_RELAY + "https://www.perdana4d.com/Results/4D?processDate=" + iso, {
      headers: { "User-Agent": UA, Accept: "text/plain,*/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(35000),
    });
    if (!res.ok) return {};
    const text = await res.text();
    return text ? parsePerdana(text, iso) : {};
  } catch { return {}; }
}
const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
const CONS = ["N", "O", "P", "Q", "R", "S", "T", "U", "V", "W"];

/**
 * Perdana Mega Jackpot - the pool, its position letter and the units that won.
 *
 * The Perdana 4D results page carries no jackpot field at all (checked
 * 13 Oct 2026): the only place those figures exist is the operator's jackpot
 * page, which perdana4d.com links straight to. That page reports ONE current
 * set rather than a figure per draw, which is what the card shows on both of
 * its draw times. Throttled and cached - the page barely moves and the
 * snapshot rebuilds constantly.
 */
const PERDANA_JP_URL = "https://pda8888.com/en/jackpot";
let perdanaJpAt = 0;
let perdanaJpCache: Record<string, string> = {};
async function perdanaJackpotValues(): Promise<Record<string, string>> {
  if (Date.now() - perdanaJpAt < 10 * 60 * 1000) return perdanaJpCache;
  perdanaJpAt = Date.now();
  const html = await get(PERDANA_JP_URL, false, 6000, 1);
  if (!html) return perdanaJpCache;
  const flat = html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const out: Record<string, string> = {};
  const pool = /USD\s?([\d,]+\.\d{2})/.exec(flat);
  if (pool) out.jp4_pool = "USD " + pool[1];
  // "A : 2620 @ USD 0.00 / 0" - position A, its number, and the units that won.
  const draw = /A\s*:\s*\d{4}\s*@\s*USD\s[\d.]+\s*\/\s*(\d+)/.exec(flat);
  if (draw) {
    out.jp4_letter = "A";
    out.jp4_units = draw[1];
  }
  if (Object.keys(out).length) perdanaJpCache = out;
  return perdanaJpCache;
}

function hariSet(j: any, iso: string): PrizeSet | null {
  if (!j || !j.prize1) return null;
  // The feed tells us the real draw date - trust it over our assumption.
  const realIso = typeof j.drawDate === "string" && j.drawDate.length >= 10 ? j.drawDate.slice(0, 10) : iso;
  return {
    prize: [j.prize1, j.prize2, j.prize3].map(String),
    special: LETTERS.map((L) => String(j["prize" + L] ?? "----")),
    cons: CONS.map((L) => String(j["prize" + L] ?? "----")),
    date: weekdayOf(realIso),
    drawNo: j.id != null && j.id !== 0 ? String(j.id) : undefined,
    // The operator prints which special column each prize came from
    // (prize1From="D"), and the cell that became a prize is left blank on the
    // board - so this is the only way to know the letter. Without it the whole
    // app showed a bare "9330" where the official board shows "D 9330"
    // (reported repeatedly, 7 Oct 2026).
    from: [j.prize1From, j.prize2From, j.prize3From].map((v) => String(v ?? "").trim()),
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
  // Accept a draw that is still being revealed, not just a finished one.
  if (!hasAnyNumber(set)) return null;
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

const sixParts = (main: string): Record<string, string> => ({
  six_2a: main.slice(0, 5), six_2b: main.slice(1),
  six_3a: main.slice(0, 4), six_3b: main.slice(2),
  six_4a: main.slice(0, 3), six_4b: main.slice(3),
  six_5a: main.slice(0, 2), six_5b: main.slice(4),
});

/** One gdlotto dated page -> the 6D / 6+1D values plus a key identifying the draw. */
function gdPartsOf(html: string): { six: SixEntry; jp: Record<string, string>; key: string } {
  const txt = clean(html);
  const jp: Record<string, string> = {};
  const m6 = /6D\s*1st\s*Prize\s+([0-9](?:\s*[0-9]){5})/.exec(txt);
  const main = m6 ? m6[1].replace(/\s+/g, "") : "";
  const six: SixEntry = main ? { main, subs: sixParts(main) } : null;
  const pool7 = /class="7d_JPool">([^<]+)</.exec(html);
  if (pool7) jp.jp7_pool = pool7[1].trim();
  const digits: string[] = [];
  for (let i = 0; i < 7; i++) {
    const mm = new RegExp('class="L7_' + i + '">([^<]+)</span>').exec(html);
    if (mm) digits.push(mm[1].trim());
  }
  if (digits.length === 7) { const g7 = digits.join(""); if (/^\d{7}$/.test(g7)) jp.jp7_grand = g7.slice(0, 6) + " + " + g7[6]; }
  return { six, jp, key: [main, jp.jp7_pool || "", digits.join("")].join("|") };
}

function gdUrl(iso: string): string {
  const [y, m, d] = iso.split("-");
  return "https://gdlotto.com/results/ajax/_result.aspx?past=1&v=1&d=" + m + "/" + d + "/" + y;
}

/**
 * Grand Dragon 6D (+ 6+1D jackpot) from the official results feed.
 *
 * gdlotto answers today's dated URL with the previous draw until today's is
 * published. Those numbers must never be paired with the live draw date the 4D
 * feed puts on the card, so while today's page still matches yesterday's the
 * cards are left blank instead of showing the previous draw.
 */
async function gdSixToday(iso: string): Promise<{ six: SixEntry; jp: Record<string, string> | null }> {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const prevDay = new Date(Date.UTC(y, m - 1, d));
    prevDay.setUTCDate(prevDay.getUTCDate() - 1);
    const prevIso = prevDay.toISOString().slice(0, 10);
    // gdlotto is frequently unreachable from our host and used to take the full
// 12s timeout plus a retry - about 24 seconds. Because this fetch sits in the
// pre-warmed snapshot build, that single source was making every page render
// wait, which is what slowed the whole app down. 4s and no retry: whatever it
// does not answer is picked up by the other Grand Dragon sources and the
// client's own (also bounded) fetch.
    const [html, prevHtml] = await Promise.all([get(gdUrl(iso), false, 4000, 0), get(gdUrl(prevIso), false, 4000, 0)]);
    if (!html) return { six: null, jp: null };
    const today = gdPartsOf(html);
    const previous = prevHtml ? gdPartsOf(prevHtml) : null;
    // gdlotto answers today's URL with the previous draw until today's is
    // published. When both pages match, the numbers the card shows are
    // yesterday's, so they must carry yesterday's date - otherwise a live date
    // sits above an older number, which is the mismatch this used to have.
    const sameDraw = !!previous && today.key === previous.key;
    const draw = sameDraw && previous ? previous : today;
    const six = draw.six ? { ...draw.six, date: weekdayOf(sameDraw ? prevIso : iso) } : null;
    // The jackpot figures carry no date of their own, and the site keeps showing
    // the previous draw's pool and grand prize until the new jackpot is settled,
    // so they only count as this draw's when they actually changed.
    const sameJp = !!previous && (today.jp.jp7_pool || "") === (previous.jp.jp7_pool || "")
      && (today.jp.jp7_grand || "") === (previous.jp.jp7_grand || "");
    /*
     * When both pages still match, the whole card IS the previous draw (it
     * carries that draw's own date), so its jackpot belongs with it - blanking
     * it there is what left 6+1D JP Pool and 6+1D Grand Prize stuck on "----"
     * for every finished draw whenever today's page repeated yesterday's
     * (reported 6 and 7 Oct 2026). The jackpot is only held back while a NEW
     * draw is already showing (pages differ) but its jackpot has not settled.
     */
    const jp = (!sameDraw && sameJp) ? null : (Object.keys(draw.jp).length ? draw.jp : null);
    return { six, jp };
  } catch { return { six: null, jp: null }; }
}

/** Read one official 9lotto value by its DOM id (n1, n2, n3, nA...). */
function nineCell(html: string, id: string): string {
  const m = new RegExp('id="' + id + '"[^>]*>\\s*(----|\\d{4})\\s*<', "i").exec(html);
  return m ? m[1] : "----";
}

/** Parse one dated official 9lotto page. Never relabel another date's draw. */
function ninePage(html: string, iso: string): { four: Record<string, string> | null; six: SixEntry; jp: Record<string, string> | null; six61: { number: string; prize: string } | null } | null {
  const pageDate = /id="inputDate"[^>]*placeholder="(\d{4}-\d{2}-\d{2})"/i.exec(html);
  if (pageDate && pageDate[1] !== iso) return null;
  const drawNoM = /class="result-date-label"[^>]*>\s*DRAW NO:\s*<\/span>\s*<span>([^<]+)<\/span>/i.exec(html);
  const prize = [nineCell(html, "n1"), nineCell(html, "n2"), nineCell(html, "n3")];
  const special = [..."ABCDEFGHIJKLM"].map((letter) => nineCell(html, "n" + letter));
  const cons = [..."NOPQRSTUVW"].map((letter) => nineCell(html, "n" + letter));
  const hasAny = [...prize, ...special, ...cons].some((v) => /^\d{4}$/.test(v));
  if (!hasAny) return null;

  const four: Record<string, string> = {
    date: weekdayOf(iso),
    first_prize: prize[0],
    second_prize: prize[1],
    third_prize: prize[2],
  };
  if (drawNoM && drawNoM[1].trim()) four.draw_no = drawNoM[1].trim();
  for (let i = 1; i <= 15; i++) four["special-" + i] = special[i - 1] || "----";
  for (let i = 1; i <= 10; i++) four["consolation-" + i] = cons[i - 1] || "----";

  let six: SixEntry = null;
  if (prize.every((v) => /^\d{4}$/.test(v))) {
    const main = prize[0][0] + prize[1][0] + prize[2][0] + prize[0][3] + prize[1][3] + prize[2][3];
    if (/^\d{6}$/.test(main)) six = { main, subs: sixParts(main) };
  }

  const jp: Record<string, string> = {};
  for (const pm of html.matchAll(/class="result-sjp-lg"[^>]*>\s*([^<]*?)\s*<\/span>/gi)) {
    const pool = pm[1].replace(/\s+/g, " ").trim();
    if (pool) { jp.n9_sj_pool = pool; break; }
  }
  const rows = html.match(/<tr class="result-numbersjp">[\s\S]*?<\/tr>/g) || [];
  for (const block of rows.slice(0, 20)) {
    const lbl = /class="char1">([^<]+)</.exec(block);
    const vals = [...block.matchAll(/class="result-sjp-prize"[^>]*>([^<]+)</g)].map((x) => x[1].trim());
    if (lbl && vals.length >= 3) jp["n9_sj_" + lbl[1].trim().replace(/\s*prize$/i, "").trim().toLowerCase()] = vals.join(" + ");
  }
  /*
   * Nine Lotto 6+1D: the seven bonus digits (r701..r707) and the flat prize
   * printed beside them. They sit in their own block on the same official page.
   */
  const bonus = ["1", "2", "3", "4", "5", "6", "7"]
    .map((n) => {
      const m = new RegExp('id="r70' + n + '"[^>]*>\\s*([^<]*?)\\s*<').exec(html);
      return m ? m[1].trim() : "";
    })
    .join("");
  const bonusPrize = /class="result-price-lg"[^>]*>\s*([^<]*USD[^<]*?)\s*</.exec(html);
  const six61 = /^\d{7}$/.test(bonus)
    ? { number: bonus, prize: bonusPrize ? bonusPrize[1].replace(/\s+/g, " ").trim() : "" }
    : null;

  return { four, six, jp: Object.keys(jp).length ? jp : null, six61 };
}

/** Nine Lotto 4D + 6D (+ Super Jackpot). If today's dated page is still
 *  yesterday's draw, use yesterday's dated page so specials and main prizes
 *  always come from the same official draw. */
async function nineOfficialToday(iso: string): Promise<{ four: Record<string, string> | null; six: SixEntry; jp: Record<string, string> | null; six61: { number: string; prize: string } | null }> {
  const [y, m, d] = iso.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d));
  prev.setUTCDate(prev.getUTCDate() - 1);
  const yIso = prev.toISOString().slice(0, 10);
  const [todayHtml, yesterdayHtml] = await Promise.all([
    get("https://9lotto.com/result/" + y + "-" + m + "-" + d),
    (() => { const [py, pm, pd] = yIso.split("-").map(Number); return get("https://9lotto.com/result/" + py + "-" + pm + "-" + pd); })(),
  ]);
  return (todayHtml && ninePage(todayHtml, iso)) || (yesterdayHtml && ninePage(yesterdayHtml, yIso)) || { four: null, six: null, jp: null, six61: null };
}/** Fast Live4D.sg Singapore feed. This publishes the current draw before the
 *  official archive and the general live feed update. */
function parseLive4dSg(json: any, iso: string): Record<string, string> | null {
  const result = json && json.result;
  if (!result || result.comp !== "SG4D" || !Array.isArray(result.n)) return null;
  const dm = /^(\d{4})(\d{2})(\d{2})$/.exec(String(result.date || ""));
  const dateIso = dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : iso;
  const nums: Record<string, string> = {};
  for (const item of result.n) {
    const v = String(item && item.i != null ? item.i : "").trim();
    if (!/^\d{4}$/.test(v)) continue;
    const p = String(item.p || "");
    const z = String(item.z || "").toUpperCase();
    if (/^[123]$/.test(p)) nums[p] = v;
    else if (/^S\d+$/.test(z)) nums["S" + Number(z.slice(1))] = v;
    else if (/^C\d+$/.test(z)) nums["C" + Number(z.slice(1))] = v;
  }
  if (!Object.values(nums).some((v) => /^\d{4}$/.test(v))) return null;
  const vals: Record<string, string> = {
    date: weekdayOf(dateIso),
    first_prize: nums["1"] || "----",
    second_prize: nums["2"] || "----",
    third_prize: nums["3"] || "----",
  };
  for (let i = 1; i <= 15; i++) vals["special-" + i] = nums["S" + i] || "----";
  for (let i = 1; i <= 10; i++) vals["consolation-" + i] = nums["C" + i] || "----";
  return vals;
}

async function live4dSgToday(iso: string): Promise<Record<string, string> | null> {
  // Use the operator's real jLive feed. The cawidget "jlive_hide" widget is a
  // secondary stream - its own payload says "special": "not primary" - and the
  // numbers it carries are not the draw - they disagreed with the official
  // Singapore Pools result and with the operator's own feeds.
  for (const url of ["http://cloud.live4d.sg/api/sg4d/jlive", "http://alpha2.live4d.sg/api/sg4d/jlive"]) {
    try {
      const j = await get(url + "?ts=" + Date.now(), true);
      const vals = j ? parseLive4dSg(j, iso) : null;
      if (vals) return vals;
    } catch { /* try the next feed */ }
  }
  return null;
}
/** Build a fresh snapshot (parallel upstream fetches). */
/** Whatever the operator's live stream has published for Singapore so far.
 *  The stream clears itself after the draw, so the capture is what keeps the
 *  live result on screen until Singapore Pools publishes the official one. */
function capturedSg(): Record<string, string> | null {
  const c = (sgLiveCapture as unknown as {
    games?: { singapore?: { date?: string; prize?: Record<string, string>; starter?: Record<string, string>; cons?: Record<string, string> } };
  }).games?.singapore;
  if (!c || !c.date) return null;
  const vals: Record<string, string> = {
    date: c.date,
    first_prize: c.prize?.["1"] || "----",
    second_prize: c.prize?.["2"] || "----",
    third_prize: c.prize?.["3"] || "----",
  };
  for (let i = 1; i <= 15; i++) vals["special-" + i] = c.starter?.[String(i)] || "----";
  for (let i = 1; i <= 10; i++) vals["consolation-" + i] = c.cons?.[String(i)] || "----";
  return vals;
}

/**
 * Magnum 4D straight from the operator's own live feed.
 *
 * magnum4d.my/live-draw is the small JSON the operator's own page polls to
 * update its numbers: about 1.2 KB and 1.4 seconds, measured 3 Oct 2026. The
 * mirror we used before has to notice the draw and republish it, and that
 * republish step is what left Magnum 15-20 seconds behind other 4D apps.
 *
 * Shape: S01-S13 are the thirteen special numbers and C01-C10 the consolations.
 * T1/T2/T3 name the LETTERS the 1st/2nd/3rd prizes were drawn from, so S03 with
 * T1="C" is the 1st prize. Those three positions are shown blank on the card,
 * exactly as the operator's own board does it.
 */
async function magnumLiveToday(iso: string): Promise<Record<string, string> | null> {
  try {
    const res = await fetch("https://www.magnum4d.my/live-draw", {
      headers: { "User-Agent": UA, Accept: "application/json,text/plain,*/*", Referer: "https://www.magnum4d.my/" },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const root = await res.json();
    const data = root?.Data;
    const r = data?.Results;
    if (!r) return null;
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(r.DrawDate || "").trim());
    if (!m) return null;
    const drawIso = `${m[3]}-${m[2]}-${m[1]}`;
    if (drawIso !== iso) return null;   // never let an older draw onto today's card

    const val = (v: unknown): string => {
      const s = v == null ? "" : String(v).trim();
      return /^\d{4}$/.test(s) ? s : "----";
    };
    const S = Array.from({ length: 13 }, (_, i) => val(r["S" + String(i + 1).padStart(2, "0")]));
    const C = Array.from({ length: 10 }, (_, i) => val(r["C" + String(i + 1).padStart(2, "0")]));
    const LETTERS = "ABCDEFGHIJKLM";
    const pick = (v: unknown) => {
      /*
       * A blank letter must mean "not drawn yet", and it did not.
       *
       * T1/T2/T3 stay blank for the whole draw - the three top prizes are only
       * named at the very end - and "ABCDEFGHIJKLM".indexOf("") is 0, not -1,
       * because an empty string matches at position 0. So every blank letter
       * was read as "A", and S01 was stamped into the 1st, 2nd AND 3rd prize
       * rows for the last twenty minutes of every draw (reported repeatedly:
       * "the same number three times on 1st, 2nd and 3rd"). Only a real A-M
       * may index the grid.
       */
      const letter = String(v ?? "").trim().toUpperCase();
      const i = /^[A-M]$/.test(letter) ? LETTERS.indexOf(letter) : -1;
      return { num: i >= 0 ? S[i] : "----", idx: i };
    };
    const p1 = pick(r.T1), p2 = pick(r.T2), p3 = pick(r.T3);
    const moved = new Set([p1.idx, p2.idx, p3.idx].filter((i) => i >= 0));

    /*
     * The two amounts the operator prints on its own Jackpot Gold card come
     * from the same file. The mirror carries its own figure, which trails the
     * operator's - that is the amount the operator's site disagreed with
     * (reported 10 Oct 2026). They travel under gold_jp* so the card-1 merge
     * skips them; the caller puts them on table-2.
     */
    // The operator's own page reads the top-level JackpotAmount; the same
    // endpoint also nests it under Data depending on the edge it answers from,
    // so both shapes are accepted.
    const goldJp = (root?.JackpotAmount?.EstimatedJackpotAmount
      || data?.JackpotAmount?.EstimatedJackpotAmount || {}) as Record<string, unknown>;
    const money = (v: unknown): string => {
      const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
      return Number.isFinite(n) && n > 0
        ? "RM " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "";
    };
    const out: Record<string, string> = {
      date: weekdayOf(drawIso),
      draw_no: String(r.DrawID || "").trim() || "----",
      first_prize: p1.num, second_prize: p2.num, third_prize: p3.num,
      gold_jp1: money(goldJp.GoldJackpot1), gold_jp2: money(goldJp.GoldJackpot2),
    };
    S.forEach((v, i) => { out["special-" + (i + 1)] = moved.has(i) ? "----" : v; });
    C.forEach((v, i) => { out["consolation-" + (i + 1)] = v; });
    // Nothing worth showing yet - leave the mirror's copy in place.
    if (p1.num === "----" && S.every((v) => /^----+$/.test(v))) return null;
    return out;
  } catch { return null; }
}

/**
 * Sabah 88 straight from the operator's own site.
 *
 * sabah88.net ships the whole draw as structured data in the page, under
 * window.SABAH88_INITIAL - no scraping of a laid-out board:
 *   n1/n2/n3  the 1st/2nd/3rd prizes
 *   s1..s13   the thirteen special numbers
 *   c1..c10   the ten consolation numbers
 * That is 103KB and ~1.2s from the operator, against a mirror that has to
 * notice the draw and republish it first.
 */
async function sabah88Today(): Promise<Record<string, string> | null> {
  try {
    const html = await get("https://www.sabah88.net/", false, 4000, 0);
    if (!html) return null;
    const m = /window\.SABAH88_INITIAL\s*=\s*([\s\S]*?);?\s*<\/script>/.exec(html);
    if (!m) return null;
    /*
     * The operator now appends a second statement to that script -
     * "...;"stale":false};window.SABAH88_DATE=null" - and JSON.parse threw on
     * the trailing text, so this whole feed was being discarded and Sabah 88
     * fell back to the mirror (found 7 Oct 2026, which is why its numbers were
     * the slowest of the eleven). Take the object and stop at the next
     * statement.
     */
    const body = m[1];
    const cut = body.indexOf(";window.");
    const json = cut >= 0 ? body.slice(0, cut) : body.replace(/;\s*$/, "");
    const feed = JSON.parse(json) as {
      draw?: Record<string, unknown>;
      lotto?: Record<string, unknown>;
      lotto5?: Record<string, unknown>[];
      lotto6?: Record<string, unknown>[];
    };
    const draw = feed.draw;
    if (!draw) return null;
    const val = (v: unknown): string => {
      const s = v == null ? "" : String(v).trim();
      return /^\d{4}$/.test(s) ? s : "----";
    };
    /** A number the operator prints, padded to its own width. */
    const num = (v: unknown, width: number): string => {
      const s = v == null ? "" : String(v).trim();
      return new RegExp("^\\d{1," + width + "}$").test(s) ? s.padStart(width, "0") : "----";
    };
    const out: Record<string, string> = {
      // The card is only fed this board when it is the draw the card shows.
      date: weekdayOf(String(draw.dd || "")),
      first_prize: val(draw.n1), second_prize: val(draw.n2), third_prize: val(draw.n3),
    };
    for (let i = 1; i <= 13; i++) out["special-" + i] = val(draw["s" + i]);
    for (let i = 1; i <= 10; i++) out["consolation-" + i] = val(draw["c" + i]);
    /*
     * The 4D Jackpot amounts sit in the same feed (draw.jp1 / draw.jp2), and
     * the card shows them under the consolation grid the way Magnum does.
     */
    const jp1 = moneyOf(draw.jp1);
    if (jp1) out.jackpot1_prize = jp1;
    const jp2 = moneyOf(draw.jp2);
    if (jp2) out.jackpot2_prize = jp2;
    /*
     * The same feed carries the operator's other boards - Sabah 3D, Lotto 6/45,
     * Lotto 5 and Lotto 6 - which the card shows underneath.
     */
    // These ids are the ones the card's 3D board already carries.
    const D3_IDS = ["first_d3_prize", "second_d3_prize", "third_d3_prize"];
    for (let i = 1; i <= 3; i++) out[D3_IDS[i - 1]] = num(draw["n1" + i], 3);
    const lotto = feed.lotto || {};
    /*
     * The card prints six numbers, a red "+" and then the bonus, so the feed's
     * seventh value belongs in the cell after the plus - writing it into the
     * plus itself left a number where the sign goes and printed last week's
     * bonus in the last cell (reported 11 Oct 2026).
     */
    for (let i = 1; i <= 6; i++) out["lotto_number_" + i] = num(lotto["n" + i], 2);
    out.lotto_number_8 = num(lotto.n7, 2);
    const lj1 = moneyOf(lotto.jp1);
    if (lj1) out.lotto_first_jackpot_prize = lj1;
    const lj2 = moneyOf(lotto.jp2);
    if (lj2) out.lotto_second_jackpot_prize = lj2;
    for (const [key, board, rows, width] of [["5", feed.lotto5, 8, 4], ["6", feed.lotto6, 5, 5]] as [string, Record<string, unknown>[] | undefined, number, number][]) {
      (board || []).slice(0, rows).forEach((g, i) => {
        out["sabahlotto" + key + "_num_" + (i + 1)] = num(g.number, width);
        out["sabahlotto" + key + "_bonus_" + (i + 1)] = num(g.bonus, 2);
        const jp = moneyOf(g.jackpot);
        if (jp) out["sabahlotto" + key + "_jp_" + (i + 1)] = jp;
      });
    }
    // Nothing published yet - leave the mirror's copy alone.
    if (Object.values(out).every((v) => v === "----")) return null;
    return out;
  } catch { return null; }
}

/**
 * Special Cash Sweep straight from the operator.
 *
 * cashsweep.com.my/live.json is the ~350 byte file its own results page fetches,
 * so it updates the moment the operator publishes. Key map, verified against
 * the 03-10-2026 draw:
 *   1 / 2 / 3     the 1st/2nd/3rd prizes
 *   9 .. 18       the ten special numbers
 *   19 .. 28      the ten consolation numbers
 * Values arrive without their leading zeros (375, 644, 148), so they are
 * padded back to four digits rather than shown short.
 */
async function cashSweepToday(): Promise<Record<string, string> | null> {
  try {
    const res = await fetch("https://www.cashsweep.com.my/live.json", {
      headers: { "User-Agent": UA, Accept: "application/json,text/plain,*/*", Referer: "https://www.cashsweep.com.my/results" },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { d?: string; n?: Record<string, number | string>; j1v?: unknown; j2v?: unknown };
    const fileIso = String(j.d || "").slice(0, 10);
    // The draw the file carries; the card decides whether it is the one shown.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fileIso)) return null;
    const n = j.n || {};
    const pad = (v: unknown): string => {
      const s = v == null ? "" : String(v).replace(/[^0-9]/g, "");
      return s ? s.padStart(4, "0").slice(-4) : "----";
    };
    const out: Record<string, string> = {
      date: weekdayOf(fileIso),
      first_prize: pad(n["1"]), second_prize: pad(n["2"]), third_prize: pad(n["3"]),
    };
    for (let i = 1; i <= 10; i++) out["special-" + i] = pad(n[String(8 + i)]);
    for (let i = 1; i <= 10; i++) out["consolation-" + i] = pad(n[String(18 + i)]);
    // Keys 4, 5 and 6 carry the operator's 3D prizes (3 digits, not 4).
    const d3 = (v: unknown): string => {
      const s = v == null ? "" : String(v).replace(/[^0-9]/g, "");
      return s ? s.padStart(3, "0").slice(-3) : "----";
    };
    out.first_d3_prize = d3(n["4"]);
    out.second_d3_prize = d3(n["5"]);
    out.third_d3_prize = d3(n["6"]);
    // The same file carries the jackpot amounts (j1v / j2v).
    const jp1 = moneyOf(j.j1v);
    if (jp1) out.jackpot1_prize = jp1;
    const jp2 = moneyOf(j.j2v);
    if (jp2) out.jackpot2_prize = jp2;
    // Nothing published yet - leave the mirror's copy alone.
    if (out.first_prize === "----") return null;
    return out;
  } catch { return null; }
}

/**
 * Sandakan (STC 4D) from the operator's own live-draw page.
 *
 * The page prints TEN consolation numbers in order, and a special board that is
 * NUMBERED 1..13. Three of those thirteen boxes are printed as "----" because
 * those specials were drawn as the 1st/2nd/3rd prize - 07-10-2026 blanks boxes
 * 3, 8 and 10; 10-10-2026 blanks 4, 5 and 8. The box number IS the position, so
 * each value is written to its own box and the blanks are kept.
 */
async function stc4dToday(): Promise<Record<string, string> | null> {
  try {
    const html = await get("https://stc4d.com/live-draw", false, 4000, 0);
    if (!html) return null;
    const four = (v: string): string => (/^\d{3,4}$/.test(v) ? v.padStart(4, "0") : "----");
    const fm = /id="ld-first"[^>]*>\s*(\d{3,4})\s*</.exec(html);
    const first = fm ? four(fm[1]) : "----";
    /*
     * Reading only the digits (what this used to do) packed the ten surviving
     * numbers into boxes 1..10, so a number the operator prints in box 11 came
     * out in box 8 and everything after the first blank sat in the wrong place
     * - the card and the operator's board disagreed on where every number was
     * (reported 11 Oct 2026). The leading "N." on each box is the position.
     */
    const boxes = new Map<number, string>();
    for (const m of html.matchAll(/min-w-\[20px\][^>]*>\s*(\d{1,2})\.<\/span>\s*<span[^>]*>\s*([^<\s]+)\s*</g)) {
      const box = Number(m[1]);
      if (box >= 1 && box <= 13) boxes.set(box, four(m[2]));
    }
    const consIdx = html.indexOf('id="ld-consolation"');
    const cons = (consIdx >= 0 ? [...html.slice(consIdx).matchAll(/tracking-\[2px\][^>]*>\s*(\d{3,4})\s*</g)] : []).map((m) => four(m[1]));
    if (first === "----" || boxes.size < 13 || cons.length < 10) return null;
    /* The board carries the draw it belongs to, so an older one can be refused. */
    const dm = /id="ld-draw-date"[^>]*>\s*(\d{2})\/(\d{2})\/(\d{4})/.exec(html);
    const dn = /id="ld-draw-no"[^>]*>\s*([^<\s]+)/.exec(html);
    const out: Record<string, string> = {
      first_prize: first,
      date: dm ? weekdayOf(`${dm[3]}-${dm[2]}-${dm[1]}`) : "----",
      draw_no: dn ? dn[1].trim() : "----",
    };
    const second = /id="ld-second"[^>]*>\s*(\d{3,4})\s*</.exec(html);
    const third = /id="ld-third"[^>]*>\s*(\d{3,4})\s*</.exec(html);
    if (second) out.second_prize = four(second[1]);
    if (third) out.third_prize = four(third[1]);
    for (const [box, v] of boxes) out["special-" + box] = v;
    for (let i = 0; i < 10; i++) out["consolation-" + (i + 1)] = cons[i];
    /*
     * The operator's jackpot pools sit on its home page, not on the live draw
     * page: "4D Jackpot 1" carries the amount in .reference-jackpot-value, and
     * "Jackpot 2 Pool" in the <strong> beside it.
     */
    const home = await get("https://stc4d.com/", false, 4000, 0);
    if (home) {
      const j1 = /class="reference-jackpot-value"[^>]*>([^<]+)</.exec(home);
      const j2 = /Jackpot 2 Pool[\s\S]{0,240}?<strong>([^<]+)</.exec(home);
      const m1 = moneyOf(j1 ? j1[1] : "");
      if (m1) out.jackpot1_prize = m1;
      const m2 = moneyOf(j2 ? j2[1] : "");
      if (m2) out.jackpot2_prize = m2;
    }
    return out;
  } catch { return null; }
}

/**
 * Da Ma Cai, both draws, from the operator's own file.
 *
 * livedraw.damacai.com.my fetches this JSON from Azure Blob storage, so it is
 * the same data their live-draw page shows. One file covers BOTH cards:
 *   p1/p2/p3 + starterList + consolidateList            -> Da Ma Cai 1+3D
 *   p13p3d/p23p3d/p33p3d + starterList3p3d + ...3p3d    -> Da Ma Cai 3+3D
 * The read token in the URL is valid until 2028; if they ever rotate it this
 * simply returns null and the mirror's copy stays on the card.
 */
const DAMACAI_JSON =
  "https://prddmcremt1.blob.core.windows.net/drawresult/DrawResult.json" +
  "?st=2018-05-24T09%3A54%3A31Z&se=2028-05-25T09%3A54%3A00Z&sp=rl&sv=2017-07-29&sr=b" +
  "&sig=inT8KHVV3QpYI7e7X0ZQ%2BNX%2BlboBg%2Fs%2FX9GTfUhfRGo%3D";

async function damacaiToday(iso: string): Promise<{ four: Record<string, string>; three: Record<string, string> } | null> {
  try {
    const res = await fetch(DAMACAI_JSON, {
      headers: { "User-Agent": UA, Accept: "application/json,text/plain,*/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(j.drawDate || "").trim());
    if (!m) return null;
    if (`${m[3]}-${m[2]}-${m[1]}` !== iso) return null;   // never an older draw
    const pad = (v: unknown, n: number): string => {
      const s = v == null ? "" : String(v).replace(/[^0-9]/g, "");
      return s ? s.padStart(n, "0").slice(-n) : "----";
    };
    const rows = (a: unknown, n: number): string[] =>
      Array.isArray(a) ? a.slice(0, 10).map((v) => pad(v, n)) : [];
    const head = { date: weekdayOf(iso), draw_no: String(j.drawNo || "").trim() || "----" };
    const four: Record<string, string> = {
      ...head,
      first_prize: pad(j.p1, 4), second_prize: pad(j.p2, 4), third_prize: pad(j.p3, 4),
    };
    rows(j.starterList, 4).forEach((v, i) => { four["special-" + (i + 1)] = v; });
    rows(j.consolidateList, 4).forEach((v, i) => { four["consolation-" + (i + 1)] = v; });
    const three: Record<string, string> = {
      ...head,
      first_prize: pad(j.p13p3d, 6), second_prize: pad(j.p23p3d, 6), third_prize: pad(j.p33p3d, 6),
    };
    rows(j.starterList3p3d, 6).forEach((v, i) => { three["special-" + (i + 1)] = v; });
    rows(j.consolidateList3p3d, 6).forEach((v, i) => { three["consolation-" + (i + 1)] = v; });
    if (four.first_prize === "----" && three.first_prize === "----") return null;
    return { four, three };
  } catch { return null; }
}

export async function buildSnapshot(): Promise<Snapshot> {
  const today = myDate(0);
  const yest = myDate(-1);
  const [home, east, sgTotoPage, sg, feed, perToday, perYest, h15, h19, h15y, h19y, gdSix, nineOfficial, sgLive4d, magnumToday, sabah88, cashSweep, stc4d, damacai] = await Promise.all([
    get("https://live4dresult.net/"),
    get("https://live4dresult.net/sabah-sarawak-4d-results/"),
    /*
     * Singapore Toto lives on the mirror's Singapore page only - its home page
     * has no Toto card. Without this the app's Toto card had no live values to
     * render, so React kept painting the ones captured on 03-09-2026 while the
     * browser-side mirror wrote the current draw into the same cells: the date
     * and the numbers flipped back and forth between the two (reported 11 Oct
     * 2026). With the card in the snapshot both writers agree.
     */
    get("https://live4dresult.net/singapore-4d-results/"),
    get("https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/fourd_result_top_draws_en.html?v=" + singaporeArchiveVersion()),
    get("https://www.live4d2u.net/liveosx.json?ts=" + Date.now(), true),
    // 4s: this host answers our server in ~14s, so a full wait stalled every
    // build. The file copy and the live feed below already carry Perdana.
    get(`https://www.perdana4d.com/Results/4D?processDate=${today.iso}`, false, 2500, 0),
    get(`https://www.perdana4d.com/Results/4D?processDate=${yest.iso}`, false, 2500, 0),
    hariFor("15:30", today.iso, today.noPad),
    hariFor("19:30", today.iso, today.noPad),
    hariFor("15:30", yest.iso, yest.noPad),
    hariFor("19:30", yest.iso, yest.noPad),
    gdSixToday(today.iso),
    nineOfficialToday(today.iso),
    live4dSgToday(today.iso),
    magnumLiveToday(today.iso),
    sabah88Today(),
    cashSweepToday(),
    stc4dToday(),
    damacaiToday(today.iso),
  ]);

  // Prefer direct/current feeds over the cloned home page.
  // The home page can publish Nine Lotto specials before its main prizes.
  const sgOfficial = parseSingapore(sg);
  const liveCards = parseLiveFeed(feed);
  const homeCards = parseCards(home);
  const eastCards = parseCards(east);
  const sgMirrorCards = parseCards(sgTotoPage);
  const cards = { ...homeCards, ...eastCards, ...sgMirrorCards, ...sgOfficial, ...liveCards };
  // Magnum's own feed wins over the mirror when it has today's draw - but a
  // blank from it must never wipe a number the mirror already published.
  if (magnumToday) {
    const base = (cards["table-1"] || {}) as Record<string, string>;
    const merged: Record<string, string> = { ...base };
    for (const [k, v] of Object.entries(magnumToday)) {
      /*
       * The three prizes are taken exactly as the operator publishes them,
       * blanks included. They stay blank until the end of the draw, and the
       * "never blank" rule below otherwise keeps a wrong value on the card for
       * the rest of the evening - which is how S01 sat on the 1st, 2nd and 3rd
       * lines long after the operator's board had them empty (7 Oct 2026).
       */
      if (k === "first_prize" || k === "second_prize" || k === "third_prize") { merged[k] = v; continue; }
      if (k.startsWith("gold_jp")) continue;   // these belong to the Jackpot Gold card
      const cur = merged[k];
      if (/^----+$/.test(v) && cur && !/^----+$/.test(cur)) continue;
      merged[k] = v;
    }
    cards["table-1"] = merged;
    // The Jackpot Gold amounts go on table-2, and the operator's own figure
    // replaces the mirror's one - that is the number its website shows.
    const gold: Record<string, string> = {};
    if (magnumToday.gold_jp1) gold.first_jackpot_prize = magnumToday.gold_jp1;
    if (magnumToday.gold_jp2) gold.second_jackpot_prize = magnumToday.gold_jp2;
    if (Object.keys(gold).length) cards["table-2"] = { ...(cards["table-2"] || {}), ...gold };
  }
  /*
   * Sabah 88 straight from the operator - but ONLY onto a card that already
   * shows TODAY's date. If the card is still on an older draw the official
   * numbers are ignored, so a parser slip can never put yesterday's draw under
   * today's heading. Never blank a value the mirror already published either.
   */
  if (sabah88) {
    const base = (cards["table-10"] || {}) as Record<string, string>;
    /*
     * The operator's board is taken whenever it is the draw the card is
     * showing - not only when that draw happens to be today. Requiring today
     * meant a card sitting on yesterday's result refused the feed (and with it
     * the jackpot, 3D and Lotto boards) until the next draw began (11 Oct 2026).
     */
    if ((base.date || "").trim() === weekdayOf(today.iso) || (sabah88.date && base.date === sabah88.date)) {
      const merged: Record<string, string> = { ...base };
      for (const [k, v] of Object.entries(sabah88)) {
        if (k === "date") continue;
        const cur = merged[k];
        if (/^----+$/.test(v) && cur && !/^----+$/.test(cur)) continue;
        merged[k] = v;
      }
      cards["table-10"] = merged;
    }
  }
  /*
   * Special Cash Sweep from the operator's own feed. This one carries its draw
   * date, so it is only used when that date IS today - an older draw can never
   * land under today's heading. A blank still never overwrites a known number.
   */
  if (cashSweep) {
    const base = (cards["table-9"] || {}) as Record<string, string>;
    // Same rule as Sabah 88: the file's own draw must be the one on the card.
    if (!cashSweep.date || base.date === cashSweep.date) {
      const merged: Record<string, string> = { ...base };
      for (const [k, v] of Object.entries(cashSweep)) {
        if (k === "date") continue;
        const cur = merged[k];
        if (/^----+$/.test(v) && cur && !/^----+$/.test(cur)) continue;
        merged[k] = v;
      }
      cards["table-9"] = merged;
    }
  }
  /*
   * Sandakan (STC 4D) from the operator's own board.
   *
   * Its special board is BOXED, so it is taken exactly - blanks included - but
   * only for the draw the card is already showing. Its "----" boxes are three
   * of the thirteen specials, blanked because they were drawn as the 1st, 2nd
   * and 3rd prize, and they belong on the card in those boxes. Treating them as
   * "no value yet" (the rule the mirror-fed cards use) kept the mirror's own
   * numbers there instead, which is how a number the operator prints in box 11
   * came out in box 8 (reported 11 Oct 2026).
   */
  if (stc4d) {
    const base = (cards["table-8"] || {}) as Record<string, string>;
    if (!stc4d.date || stc4d.date === "----" || base.date === stc4d.date) {
      cards["table-8"] = { ...base, ...stc4d };
    }
  }
  /*
   * Da Ma Cai, straight from its operator. Merged over the mirror the way the
   * mirror-fed cards are: a blank never replaces a number the mirror already
   * published, so a source that drops out cannot empty a card.
   */
  for (const [cls, vals] of [
    ["table-4", damacai ? damacai.four : null],
    ["table-5", damacai ? damacai.three : null],
  ] as [string, Record<string, string> | null][]) {
    if (!vals) continue;
    /*
     * A date on its own is not a result.
     *
     * Da Ma Cai publishes one file for both of its draws, and it carries the new
     * draw date as soon as the 1+3D draw is over - while the 3+3D numbers are
     * still blank. The "a blank never replaces a known number" rule below then
     * kept the previous draw's numbers and let the new date through, so the card
     * read 10-10-2026 across numbers drawn on 07-10 (reported 10 Oct 2026). A
     * payload that brings no numbers of its own may not set the date.
     */
    const hasOwnResult = Object.entries(vals).some(([k, v]) =>
      k !== "date" && k !== "draw_no" && !!v && !/^----+$/.test(String(v)));
    if (!hasOwnResult) continue;
    const base = (cards[cls] || {}) as Record<string, string>;
    const merged: Record<string, string> = { ...base };
    for (const [k, v] of Object.entries(vals)) {
      const cur = merged[k];
      if (/^----+$/.test(v) && cur && !/^----+$/.test(cur)) continue;
      merged[k] = v;
    }
    cards[cls] = merged;
  }
  /*
   * Grand Dragon and Nine Lotto publish THIRTEEN special numbers (A-M), but
   * their cards have fifteen cells laid out three rows of five - the last two
   * are spare. A copy of the 13th value was landing in cell 14, so 6787 and
   * 1993 each appeared TWICE on the card (reported 3 Oct 2026).
   *
   * Those two slots can never hold a real number for these games, so they are
   * forced blank here, whatever source put something there.
   */
  /*
   * Sports Toto 4D publishes THIRTEEN specials but its card carries fifteen
   * slots. Slot 14 caught a stray value once while the grid was filling, and the
   * "a blank never replaces a known number" rule kept it there for good - the
   * feeds send nothing for that slot, so nothing could ever clear it. That is
   * why 9184 sat in both cell 13 and cell 14.
   *
   * Slots 14 and 15 hold no real number for this game, so they are forced blank
   * every build - the cause, rather than deleting the duplicate each time.
   */
  /*
   * Every card carries fifteen special slots, but most games publish fewer.
   * A slot past the end of the game's grid is not a result - it is whatever the
   * mirror left behind, kept there for ever by the "never blank a known number"
   * rule. That is what showed Sandakan's last three numbers a second time in
   * cells 11 to 13, and Da Ma Cai's tenth number again in cell 11 (reported
   * 7 Oct 2026). The counts below are each game's own published grid, checked
   * against the operator: Magnum 13, Sports Toto 13, Sabah 88 13, Sandakan 13,
   * Grand Dragon 13, Nine Lotto 13, and ten for Da Ma Cai (both draws), Cash
   * Sweep and Singapore.
   */
  const SPECIAL_SLOTS: Record<string, number> = {
    "table-1": 13, "table-4": 10, "table-5": 10, "table-6": 13,
    "table-8": 13, "table-9": 10, "table-10": 13, "table-11": 10,
    "table-13": 13, "table-17": 13,
  };
  for (const [cls, used] of Object.entries(SPECIAL_SLOTS)) {
    const c = cards[cls] as Record<string, string> | undefined;
    if (!c) continue;
    for (let i = used + 1; i <= 15; i++) c["special-" + i] = "----";
  }
  /*
   * The three east cards (Sandakan, Cash Sweep, Sabah 88) are captured HTML and
   * address their cells as special_number_N / consolation_number_N - not
   * special-N. The snapshot only ever carried the feed's special-N keys, so
   * nothing on those cards ever moved: they stayed on whatever the page was
   * captured with, and none of the spare-cell rules above could reach them.
   *
   * Sabah 88 showed it plainly. The mirror prints its thirteen specials across
   * cells 1-10 and 12-14, leaving cell 11 spare, so the last number sits in
   * cell 14 - one column past where the operator's board has it - and while the
   * draw is running the card keeps the captured leftovers beside it (reported
   * 10 Oct 2026). The feed carries the same numbers in the operator's order, so
   * they are copied onto the ids the card actually reads, with every slot past
   * the game's own grid blanked.
   */
  for (const [cls, used] of [["table-8", 13], ["table-9", 10], ["table-10", 13]] as [string, number][]) {
    const c = cards[cls] as Record<string, string> | undefined;
    if (!c) continue;
    for (let i = 1; i <= 15; i++) {
      const v = i <= used ? c["special-" + i] : "";
      c["special_number_" + i] = v && !/^----+$/.test(v) ? v : "----";
    }
    for (let i = 1; i <= 10; i++) {
      const v = c["consolation-" + i];
      c["consolation_number_" + i] = v && !/^----+$/.test(v) ? v : "----";
    }
  }
  // Singapore sources can arrive out of order. Use the newest dated result and
  // merge same-date fields so an older archive never overwrites a live draw.
  const sgDate = (v?: Record<string, string>): number => {
    const m = /(\d{2})-(\d{2})-(\d{4})/.exec(v?.date || "");
    return m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : 0;
  };
  // Same-date priority: official Singapore Pools > live4d2u > the live stream >
  // the capture. A blank never replaces a number that is already known, so the
  // stream clearing itself cannot wipe a draw that is on screen.
  const sgParts = [capturedSg(), sgLive4d, liveCards["table-11"], sgOfficial["table-11"]].filter(Boolean) as Record<string, string>[];
  if (sgParts.length) {
    const isDashVal = (v: string) => /^----+$/.test(String(v || "").trim());
    /**
     * A DATE on its own is not a result.
     *
     * live4d.sg opens a new draw entry the moment the draw starts: today's date
     * with a single 1st-prize flag and an empty number list. Taking the newest
     * DATE threw away the complete board we already held, so the Singapore card
     * went from a full result to blank in one step - reported on 3 Oct 2026 as
     * "1st/2nd/3rd missing, blank suddenly", with the board left half filled.
     *
     * Only move to the newer date once it carries its main prizes; until then
     * keep serving the last COMPLETE draw, with its own date on the card. That
     * is never wrong - it is just the previous draw until today's is real.
     */
    /*
     * A date counts as live as soon as ANY of its numbers is published - not
     * only once all three main prizes are in. Waiting for the whole board held
     * the card on the previous draw right through the reveal, which is why
     * Singapore stopped showing anything live and then produced the finished
     * result in one step (reported 4 Oct 2026).
     *
     * What it still refuses is a date with NO numbers at all - that is the case
     * that used to blank the card, and it stays blocked.
     */
    const hasAnyResult = (b?: Record<string, string>): boolean =>
      !!b && Object.entries(b).some(([k, v]) =>
        k !== "date" && k !== "draw_no" && !!v && !isDashVal(v));
    let newest = Math.max(...sgParts.map((p) => sgDate(p)));
    if (!sgParts.some((p) => sgDate(p) === newest && hasAnyResult(p))) {
      const liveDates = sgParts.filter((p) => hasAnyResult(p)).map((p) => sgDate(p)).filter((d) => d > 0);
      if (liveDates.length) newest = Math.max(...liveDates);
    }
    // Seed from the card we already have ONLY when it is the same draw.
    //
    // Seeding from an older one carried its numbers into every slot the new
    // draw had not published yet, and the rule below ("a blank never replaces a
    // known number") then kept them there. That is how 27/09s 1st prize, 8791,
    // ended up sitting under 30/09s date mixed with a few numbers from the new
    // draw - which reads as "the app has no live result".
    const baseSg = (cards["table-11"] || {}) as Record<string, string>;
    const finalSg: Record<string, string> = sgDate(baseSg) === newest ? { ...baseSg } : {};
    for (const p of sgParts) {
      if (sgDate(p) !== newest) continue;
      for (const [k, v] of Object.entries(p)) {
        if (v === undefined || v === null || v === "") continue;
        const cur = finalSg[k];
        if (isDashVal(v) && cur && !isDashVal(cur)) continue;
        finalSg[k] = String(v);
      }
    }
    // Anything today's sources have not published yet is blank, never
    // yesterday's number.
    if (newest > 0 && !finalSg.date) {
      finalSg.date = weekdayOf(new Date(newest).toISOString().slice(0, 10));
    }
    for (const k of ["first_prize", "second_prize", "third_prize"]) {
      if (!(k in finalSg)) finalSg[k] = "----";
    }
    for (let i = 1; i <= 15; i++) {
      if (!("special-" + i in finalSg)) finalSg["special-" + i] = "----";
    }
    for (let i = 1; i <= 10; i++) {
      if (!("consolation-" + i in finalSg)) finalSg["consolation-" + i] = "----";
    }
    // Live4D.sg publishes the new draw before it knows the official draw
    // number. Never keep the previous draw's number with the new date.
    const anyDrawNo = sgParts.some((p) => sgDate(p) === newest && p.draw_no && !isDashVal(p.draw_no));
    if (!anyDrawNo && newest > Math.max(0, ...sgParts.filter((p) => sgDate(p) < newest).map((p) => sgDate(p)))) {
      finalSg.draw_no = "----";
    }
    // The other 4D apps publish a new draw a few minutes before any source we
    // have. Today's date with an empty board looks like a broken app, so until
    // the new draw has its main prizes keep the last complete result on screen
    // - it is never wrong, only a little older.
    // Whatever the sources have for the newest date is what is shown, even when
    // the draw is still being revealed and some prizes are still "----". Falling
    // back to the last complete board looked tidier but meant showing yesterday
    // under today and then flicking forward again, which is worse.
    cards["table-11"] = finalSg;
  }
  // 9lotto.com is the authority for this card and is used whenever it has
  // anything at all; otherwise the live archive's own board is kept. Never
  // fall back to the previous snapshot: that put yesterday's finished draw
  // back on screen in the middle of today's live reveal.
  /*
   * 9lotto.com is the authority for this card - but its gaps must not ERASE a
   * number the mirror already published. This used a plain spread, so a blank
   * cell on the operator page overwrote a good value and a special number
   * simply vanished from the middle of the grid (reported 04-10-2026).
   *
   * Same rule as everywhere else: a blank never replaces a known number. The
   * positions the prizes were drawn from are still cleared by the final pass
   * below, so this cannot reintroduce a duplicate.
   */
  /*
   * 9lotto.com's board is the truth - shown EXACTLY as published, blanks and
   * all.
   *
   * This used to be a guarded merge that kept any value the mirror had when the
   * operator showed a blank. That is wrong here: the operator's blanks are
   * deliberate, and merging left a stale number sitting in cell 13 where their
   * board has nothing (and earlier erased 4538 from cell 5). The official board
   * is never second-guessed.
   */
  if (nineOfficial.four) cards["table-17"] = { ...(cards["table-17"] || {}), ...nineOfficial.four };
  /*
   * Nine Lotto 6+1D rides on the 6D card's class so the inline writer fills it
   * too; only the 6+1D card carries cells with these data-ids.
   */
  if (nineOfficial.six61) {
    cards["table-18"] = {
      ...(cards["table-18"] || {}),
      ...(nineOfficial.four && nineOfficial.four.date ? { date: nineOfficial.four.date } : {}),
      n9_61_result: nineOfficial.six61.number,
      n9_61_prize: nineOfficial.six61.prize || "----",
    };
  }

  const perdana: Record<string, PrizeSet | null> = { "15:30": null, "19:30": null };
  for (const [html, d] of [[perToday, today], [perYest, yest]] as [string | null, { iso: string; noPad: string }][]) {
    if (!html) continue;
    const sets = parsePerdana(html, d.iso);
    for (const time of ["15:30", "19:30"]) {
      const s = sets[time];
      if (hasAnyNumber(s) && !perdana[time]) perdana[time] = s;
    }
  }

  // Official draws collected by the GitHub job, for hosts that cannot reach
  // perdana4d.com themselves. This is read BEFORE the reader below: the
  // operator page answers our server in ~14s, so calling the reader first put
  // that wait on every build that still had an empty slot.
  const fileDays = (perdanaOfficial as unknown as { days?: Record<string, Record<string, PrizeSet>> }).days || {};
  for (const [time, set] of Object.entries(fileDays[today.iso] || {})) {
    if (!(time in perdana)) continue;   // only the two live draw times
    if (!perdana[time] && set && set.prize.length && set.prize.some((v) => !isDash(v))) {
      perdana[time] = { ...set, date: weekdayOf(today.iso) };
    }
  }
  // Official page first, then the collected copy, then the reader, then the
  // shared live feed - so a draw is shown as soon as any of them has it.
  const missingPerdana = ["15:30", "19:30"].filter((t) => !perdana[t]);
  if (missingPerdana.length) {
    const relayed = await perdanaFromRelay(today.iso);
    for (const t of missingPerdana) if (relayed[t]) perdana[t] = relayed[t];
  }
  /* The shared feed carries one Perdana draw with no time on it; perdanaFromFeed
     decides which session that is from the clock. */
  const feedPerdana = perdanaFromFeed(feed);
  for (const t of ["15:30", "19:30"]) {
    if (!perdana[t] && feedPerdana[t]) perdana[t] = feedPerdana[t];
  }
  /*
   * A session that is due today but not published yet shows today's date and
   * an empty board, never yesterday's result.
   *
   * The operator opens the new Perdana draw late, and until it does every
   * source still returns the previous draw - so the 3:30PM card kept showing
   * yesterday's numbers under yesterday's date right through the new slot, and
   * the page read as "no live result" once the new draw was due (reported
   * 13 Oct 2026). Lucky HariHari already behaves this way on the card; Perdana
   * gets the same rule here so the page's inline writer and React agree.
   */
  const slotMinutes: Record<string, number> = { "15:30": 15 * 60 + 30, "19:30": 19 * 60 + 30 };
  const myNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const nowMins = myNow.getUTCHours() * 60 + myNow.getUTCMinutes();
  const dash = (n: number) => Array(n).fill("----");
  for (const t of ["15:30", "19:30"]) {
    const s = perdana[t];
    if (!s || !s.date) continue;
    if (!s.prize.some((v) => !!v && !/^----+$/.test(v))) continue;   // a real draw is on the board
    if (nowMins < slotMinutes[t]) continue;            // this session has not started
    const sm = /(\d{2})-(\d{2})-(\d{4})/.exec(s.date);
    if (!sm) continue;
    if (`${sm[3]}-${sm[2]}-${sm[1]}` === today.iso) continue;   // already today
    perdana[t] = { prize: dash(3), special: dash(13), cons: dash(10), date: weekdayOf(today.iso) };
  }

  /*
   * Perdana's jackpot rows live on their own card values, not in the draw
   * slots: the operator publishes one current pool / letter / units set, shown
   * the same on both draw times. The fetch is kicked off rather than awaited so
   * a slow jackpot page never holds a snapshot build; the build after it lands
   * picks the values up from the cache.
   */
  void perdanaJackpotValues();
  if (Object.keys(perdanaJpCache).length) {
    cards["table-16"] = { ...(cards["table-16"] || {}), ...perdanaJpCache };
  }

  // A source that drops out for one round must not wipe the cards we already
  // had: blank cards were being served until the next successful rebuild.
  if (cache) {
    for (const [cls, vals] of Object.entries(cache.cards || {})) {
      if (!cards[cls]) cards[cls] = vals;
    }
  }

  const hari: Record<string, HariEntry> = { "15:30": h15 || h15y, "19:30": h19 || h19y };

  /**
   * A card never moves backwards to an older draw.
   *
   * While a draw is being revealed the sources keep handing the previous one
   * back for a few seconds. That is what made cards flip to yesterday mid-draw
   * - reported first on Nine Lotto and then on Perdana, and it could happen to
   * any of the eleven. Every writer on the phone has its own guard, but the
   * surest place to stop it is here, once, for every game: if a source is
   * behind what we already published, the older value is dropped.
   */
  const dayScore = (label?: string): number => {
    const m = /(\d{2})-(\d{2})-(\d{4})/.exec(label || "");
    return m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : 0;
  };
  const isOlder = (nextDate?: string, prevDate?: string): boolean => {
    const a = dayScore(nextDate), b = dayScore(prevDate);
    return !!(a && b && a < b);
  };
  const isDash = (v?: string) => !v || /^----+$/.test(String(v).trim());
  /** Same draw: keep every number we have already shown, add the new ones. */
  const addNew = (before: Record<string, string>, now: Record<string, string>): Record<string, string> => {
    const out: Record<string, string> = { ...before, ...now };
    for (const k of Object.keys(before)) if (isDash(now[k]) && !isDash(before[k])) out[k] = before[k];
    return out;
  };
  const prev = cache;
  if (prev) {
    for (const [cls, vals] of Object.entries(cards)) {
      const before = prev.cards ? prev.cards[cls] : undefined;
      if (!before) continue;
      if (isOlder(vals.date, before.date)) { cards[cls] = before; continue; }
      if (dayScore(vals.date) && dayScore(vals.date) === dayScore(before.date)) cards[cls] = addNew(before, vals);
    }
    for (const t of ["15:30", "19:30"]) {
      // `in` keeps a 15:30 entry from an older snapshot out of the record now
      // that Perdana runs a single draw.
      if (t in perdana) {
        const pBefore = prev.perdana ? prev.perdana[t] : null;
        const pNow = perdana[t];
        if (pBefore && pNow && isOlder(pNow.date, pBefore.date)) perdana[t] = pBefore;
        else if (pBefore && !pNow) perdana[t] = pBefore;
      }

      const hBefore = prev.hari ? prev.hari[t] : null;
      const hNow = hari[t];
      const hWas = hBefore && hBefore.set ? hBefore.set.date : undefined;
      const hIs = hNow && hNow.set ? hNow.set.date : undefined;
      if (hBefore && hWas && hIs && isOlder(hIs, hWas)) hari[t] = hBefore;
      else if (hBefore && !hNow) hari[t] = hBefore;
    }
  }

  /*
   * 9lotto.com's board is the truth for Nine Lotto, INCLUDING its blanks.
   *
   * The official values are merged into the card further up, but the cache
   * pass above runs after that, and its "a blank never replaces a known
   * number" rule puts the three prize numbers straight back into the special
   * grid. The operator blanks the three positions its prizes were drawn
   * from, so the card then disagreed with the operator and the two fought
   * each other - reported 08-10-2026 as the Nine Lotto special column
   * flickering between the right and the wrong value.
   *
   * Re-applied here, after the cache pass, and only when the official board
   * is for the SAME draw the card is already showing. If the operator is
   * still serving yesterday's page while today's draw is on the card, the
   * cache pass is right to keep today's, so that case is left alone.
   */
  {
    const off = nineOfficial.four;
    const c = cards["table-17"] as Record<string, string> | undefined;
    if (off && c && dayScore(off.date) && dayScore(off.date) === dayScore(c.date)) {
      cards["table-17"] = { ...c, ...off };
    }
  }

  /*
   * Magnum, Grand Dragon and Nine Lotto draw their 1st/2nd/3rd prizes OUT of
   * their special numbers, so the operator blanks those three positions on its
   * own board. If any writer leaves the winning number in the grid as well, the
   * same number shows twice - once as the prize and again as a "special", which
   * is what Magnum showed on 04-10-2026 (1st prize 2306 and special-1 2306).
   *
   * Done here, at the very END, because the merge and "never move backwards"
   * passes above both treat a blank as "no news" and would put the duplicate
   * back. Only these three games are touched: for Singapore or Da Ma Cai a
   * number may legitimately appear as both a prize and a starter.
   */
  /*
   * NOTE: only Magnum and Grand Dragon are listed here.
   *
   * Nine Lotto was in this list and it was WRONG: its operator shows the
   * winning number in the special grid AS WELL as in the prize row - on
   * 04-10-2026 the 3rd prize and special E were both 4538. Blanking it removed a
   * number the player can see on the operator's own board. Each operator does it
   * differently, so this can only be applied where it has been checked.
   */
  /*
   * These checks apply ONLY to the cards still fed by a mirror.
   *
   * The official boards sometimes publish the same number twice, and that is a
   * real result - not a mistake. Rewriting an official board would hide a number
   * the player can see on the operator's own page, which is worse than the
   * duplicate. Only mirror-sourced cards are sanity-checked, because the
   * mid-reveal glitches come from there: Magnum Life, Magnum Jackpot Gold and
   * the two Sports Toto cards.
   */
  /*
   * Grand Dragon 4D (table-13) belongs here too: its 4D card is fed by the
   * mirrors, not by an operator page - only its 6D comes from gdlotto. Without
   * it the stale value in cell 13 that copies cell 12 is never cleared, which is
   * exactly what was reported on 04-10-2026.
   */
  const MIRROR_ONLY = ["table-2", "table-3", "table-6", "table-7", "table-13"];
  /*
   * A mirror card must not wear a new date while it is still showing the old
   * draw's numbers.
   *
   * The mirror turns the date cell over as soon as a draw is announced and
   * republishes the numbers a few minutes later, so for those minutes the card
   * read "10-10-2026" across every number drawn on 07-10 (reported 10 Oct 2026
   * for Sports Toto 5D/6D and Magnum Life). A new date is only accepted once at
   * least one of the card's numbers has actually changed from the copy already
   * on screen; until then the card stays on the last draw we can vouch for,
   * which is the rule Singapore has used since 3 Oct.
   */
  for (const cls of MIRROR_ONLY) {
    const c = cards[cls] as Record<string, string> | undefined;
    const prev = cache?.cards?.[cls] as Record<string, string> | undefined;
    if (!c || !prev) continue;
    if (!c.date || !prev.date || c.date === prev.date) continue;
    const numbersMoved = Object.keys(c).some((k) =>
      k !== "date" && k !== "draw_no" && !!c[k] && c[k] !== prev[k] && !/^----+$/.test(String(c[k])));
    if (!numbersMoved) cards[cls] = { ...prev };
  }
  for (const cls of MIRROR_ONLY) {
    const c = cards[cls] as Record<string, string> | undefined;
    if (!c) continue;
    const prizes = [c.first_prize, c.second_prize, c.third_prize].filter((v) => v && !/^----+$/.test(v));
    if (!prizes.length) continue;
    for (let i = 1; i <= 15; i++) {
      const v = c["special-" + i];
      if (v && !/^----+$/.test(v) && prizes.includes(v)) c["special-" + i] = "----";
    }
  }

  /*
   * The three main prizes are ALWAYS three different numbers in a real draw.
   *
   * While a draw is being revealed the feeds sometimes push the first number
   * they have into all three prize cells - Magnum showed 2306 as 1st, 2nd and
   * 3rd at 19:21 on 04-10-2026, then corrected itself a minute later. We were
   * passing that straight through, so the app showed a result that cannot
   * happen.
   *
   * A repeated prize therefore means "this board is not finished yet", and the
   * three cells are held blank rather than showing a number that may be wrong.
   * They fill in the moment the real values differ. Checked for every game: a
   * draw never repeats a number across 1st, 2nd and 3rd.
   */
  for (const cls of MIRROR_ONLY) {
    const c = cards[cls] as Record<string, string> | undefined;
    if (!c) continue;
    const p = [c.first_prize, c.second_prize, c.third_prize];
    const real = p.filter((v) => v && !/^----+$/.test(v));
    if (real.length >= 2 && new Set(real).size < real.length) {
      c.first_prize = "----";
      c.second_prize = "----";
      c.third_prize = "----";
    }
  }

  /*
   * A draw never repeats a number INSIDE the same grid.
   *
   * Several feeds publish thirteen special numbers into a fifteen-cell grid and
   * leave the last one sitting in the spare cell too - Sports Toto 4D showed
   * 9184 in both cell 13 and cell 14 on 04-10-2026, exactly the fault Grand
   * Dragon and Nine Lotto had. That fix named only those two games, which is
   * why it came back on a third.
   *
   * This runs for EVERY card instead. The first occurrence is kept and the
   * repeat is blanked: if the value genuinely belongs in that slot it stays, and
   * if the feed was one cell out the duplicate disappears rather than showing
   * twice. Same rule for the consolation row.
   */
  for (const cls of MIRROR_ONLY) {
    const c = cards[cls] as Record<string, string> | undefined;
    if (!c) continue;
    for (const [prefix, count] of [["special-", 15], ["consolation-", 10]] as [string, number][]) {
      const seenNums = new Set<string>();
      for (let i = 1; i <= count; i++) {
        const k = prefix + i;
        const v = c[k];
        if (!v || /^----+$/.test(v)) continue;
        if (seenNums.has(v)) c[k] = "----";
        else seenNums.add(v);
      }
    }
  }

  /*
   * A cell in these grids holds a four-digit number or nothing at all.
   *
   * Sports Toto marks its empty special cells with "****", and that was landing
   * on the card as though it were one of the winning numbers (reported 4 Oct
   * 2026). Anything that is not a number is blanked here, so the card shows the
   * same empty cell the operator does. Only the mirror-fed cards are touched -
   * an operator's own board is never rewritten.
   */
  for (const cls of MIRROR_ONLY) {
    const c = cards[cls] as Record<string, string> | undefined;
    if (!c) continue;
    for (const [prefix, count] of [["special-", 15], ["consolation-", 10]] as [string, number][]) {
      for (let i = 1; i <= count; i++) {
        const k = prefix + i;
        const v = c[k];
        if (!v || /^----+$/.test(v)) continue;
        if (!/^\d{3,4}$/.test(v.trim())) c[k] = "----";
      }
    }
  }

  /*
   * Magnum draws its 1st, 2nd and 3rd prizes OUT of the thirteen special
   * numbers, and the operator's own board leaves those three positions empty.
   * The mirror can still show the number sitting in the grid beside the prize -
   * the "same number twice" report - and so does the card whenever Magnum's own
   * (4-second, no-retry) feed happens to be slow, because the blank the feed
   * sends is refused by the "never blank a known number" rule.
   *
   * So the rule is applied to the finished card instead, whichever source
   * supplied the numbers: a special cell holding one of the three prizes IS the
   * cell that prize was drawn from and is cleared. Only the first match per
   * prize, so a genuinely repeated special is never thrown away.
   */
  {
    const c = cards["table-1"] as Record<string, string> | undefined;
    if (c) {
      for (const k of ["first_prize", "second_prize", "third_prize"]) {
        const won = (c[k] || "").trim();
        if (!/^\d{4}$/.test(won)) continue;
        for (let i = 1; i <= 13; i++) {
          const cell = "special-" + i;
          if ((c[cell] || "").trim() === won) { c[cell] = "----"; break; }
        }
      }
    }
  }

  const snap: Snapshot = {
    at: Date.now(), cards, perdana,
    hari,
    gd6: gdSix.six, gdjp7: gdSix.jp, nine6: nineOfficial.six, nineJp: nineOfficial.jp,
  };
  cache = snap;
  return snap;
}

/**
 * Cached snapshot.
 *
 * A stale copy is handed over straight away and refreshed in the background.
 * Waiting for the rebuild blocked every page render for 2-3 seconds whenever
 * the 5 second TTL had lapsed - which, on a server that only wakes when
 * someone opens the app, was most page loads. The numbers are still refreshed
 * just as often; they are simply never made to hold up the page.
 */
/**
 * @param opts.wait  Wait for a fresh build when the cached copy is older than
 *   the freshness limit. The data endpoints the phone polls every few seconds
 *   pass true so they always answer with current numbers. Page renders pass
 *   false (the default) and take whatever is cached: waiting there was making
 *   the app take 5.6 seconds just to receive its HTML, and the page corrects
 *   itself a second later anyway from the polling endpoint.
 */
export async function getSnapshot(opts: { wait?: boolean } = {}): Promise<Snapshot> {
  startWarmer();
  const cached = cache;
  if (cached && Date.now() - cached.at < FRESH_MS) return cached;
  const usable = cached && Object.keys(cached.cards || {}).length > 0;
  const age = cached ? Date.now() - cached.at : Number.POSITIVE_INFINITY;
  // Page renders (wait: false) still take a copy up to MAX_STALE_MS old and
  // refresh behind it. Blocking a render on a rebuild once made the homepage
  // take 11 seconds to open, which is worse than a number that is a second late.
  if (!opts.wait && cached && usable && age < MAX_STALE_MS) {
    void rebuildOnce().catch(() => {});
    return cached;
  }
  // Polling endpoints wait: a copy older than FRESH_MS is not worth sending.
  try { return await rebuildOnce(); }
  catch (e) {
    // A failed sweep must not turn into a blank page - keep the last good copy.
    if (cached && usable) return cached;
    throw e;
  }
}

/** A snapshot with no numbers in it, for a render that has nothing cached yet. */
function emptySnapshot(): Snapshot {
  return { at: 0, cards: {}, perdana: {}, hari: {} } as Snapshot;
}

/**
 * The copy a page render may use.
 *
 * It NEVER waits at runtime. A render that did wait had to run the whole sweep
 * of ~13 upstream pages before it could send its first byte, so tapping the app
 * icon sat on the splash for 1-5 seconds (measured 11 Oct 2026: 5.29s, 3.11s,
 * 2.85s, 2.35s, 1.29s, 0.87s on six requests in a row, every one of them a
 * cache MISS). Whatever is in memory goes into the HTML and the page corrects
 * itself from /api/home-live a moment later - which is exactly what the boot
 * script and the live-pending mask are for.
 *
 * The build is the one place that still waits: the pre-rendered HTML is what a
 * search engine reads, so it has to carry the numbers.
 */
export async function getSnapshotForRender(): Promise<Snapshot> {
  startWarmer();
  const cached = cache;
  if (cached && Object.keys(cached.cards || {}).length > 0) {
    // Refresh behind the response once the copy is past its useful age.
    if (Date.now() - cached.at >= FRESH_MS) void rebuildOnce().catch(() => {});
    return cached;
  }
  if (process.env.NEXT_PHASE === "phase-production-build") return await rebuildOnce();
  // Nothing cached: hand over an empty snapshot, build for the next request.
  void rebuildOnce().catch(() => {});
  return emptySnapshot();
}

export function startWarmer() {
  if (warmer) return;
  warmer = setInterval(() => { void rebuildOnce().catch(() => {}); }, SNAPSHOT_TTL);
  (warmer as unknown as { unref?: () => void }).unref?.();
}
