import perdanaOfficial from "./perdana-official.json";
/**
 * Server-side live snapshot: keeps a warm copy of every result card and of the
 * Perdana / Lucky HariHari draws so pages can render the CURRENT numbers in
 * their HTML (no waiting for the browser to fetch anything).
 */
export type PrizeSet = { prize: string[]; special: string[]; cons: string[]; date?: string; drawNo?: string };
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
export const SNAPSHOT_TTL = 5000;

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
      const byPos = (letters: string) =>
        [...letters].map((L) => val(new RegExp('fourDPosition="[^"]*' + L + '"[^>]*>\\s*(?:\\([A-Z]\\)\\s*)?(----|\\d{4})')));
      const set: PrizeSet = {
        prize: [cell("4dFirst"), cell("4dSecond"), cell("4dThird")],
        special: byPos("ABCDEFGHIJKLM"),
        cons: byPos("NOPQRSTUVW"),
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
    const prize = pIdx >= 0 && sIdx > pIdx ? grab(pIdx + 1, sIdx, 3) : [];
    while (prize.length < 3) prize.push("----");
    const special = sIdx >= 0 ? grab(sIdx + 1, cIdx > sIdx ? cIdx : block.length, 13) : [];
    while (special.length < 13) special.push("----");
    const cons = cIdx >= 0 ? grab(cIdx + 1, block.length, 10) : [];
    while (cons.length < 10) cons.push("----");
    const set: PrizeSet = { prize, special, cons, date: weekdayOf(drawIso) };
    if (hasAnyNumber(set) && !out[time]) out[time] = set;
  }
  return out;
}/** Hour of the day in Kuala Lumpur. */
function klHour(): number {
  try {
    return Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  } catch { return new Date().getHours(); }
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
 * It holds ONE draw per day with no time, so the draw is filed under the slot
 * it belongs to - the evening draw once that has passed, otherwise the
 * afternoon one - and the card always carries the feed's own date, never a
 * date borrowed from somewhere else.
 */
function perdanaFromFeed(feed: unknown): Record<string, PrizeSet | null> {
  const out: Record<string, PrizeSet | null> = { "15:30": null, "19:30": null };
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
  const today = myDate(0).iso;
  const slot = iso && iso >= today ? (klHour() >= 19 ? "19:30" : "15:30") : "19:30";
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
  return "https://gdlotto.net/results/ajax/_result.aspx?past=1&v=1&d=" + m + "/" + d + "/" + y;
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
    const [html, prevHtml] = await Promise.all([get(gdUrl(iso)), get(gdUrl(prevIso))]);
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
    // The jackpot figures carry no date of their own, so an older draw's figures
    // would read as today's. Until today's draw is published there is no jackpot.
    const jp = sameDraw ? null : (Object.keys(draw.jp).length ? draw.jp : null);
    return { six, jp };
  } catch { return { six: null, jp: null }; }
}

/** Read one official 9lotto value by its DOM id (n1, n2, n3, nA...). */
function nineCell(html: string, id: string): string {
  const m = new RegExp('id="' + id + '"[^>]*>\\s*(----|\\d{4})\\s*<', "i").exec(html);
  return m ? m[1] : "----";
}

/** Parse one dated official 9lotto page. Never relabel another date's draw. */
function ninePage(html: string, iso: string): { four: Record<string, string> | null; six: SixEntry; jp: Record<string, string> | null } | null {
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
  return { four, six, jp: Object.keys(jp).length ? jp : null };
}

/** Nine Lotto 4D + 6D (+ Super Jackpot). If today's dated page is still
 *  yesterday's draw, use yesterday's dated page so specials and main prizes
 *  always come from the same official draw. */
async function nineOfficialToday(iso: string): Promise<{ four: Record<string, string> | null; six: SixEntry; jp: Record<string, string> | null }> {
  const [y, m, d] = iso.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d));
  prev.setUTCDate(prev.getUTCDate() - 1);
  const yIso = prev.toISOString().slice(0, 10);
  const [todayHtml, yesterdayHtml] = await Promise.all([
    get("https://9lotto.com/result/" + y + "-" + m + "-" + d),
    (() => { const [py, pm, pd] = yIso.split("-").map(Number); return get("https://9lotto.com/result/" + py + "-" + pm + "-" + pd); })(),
  ]);
  return (todayHtml && ninePage(todayHtml, iso)) || (yesterdayHtml && ninePage(yesterdayHtml, yIso)) || { four: null, six: null, jp: null };
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
  try {
    const j = await get("http://cawidget.live4d.sg/json_4d/api_4d_jlive_hide.asp?ts=" + Date.now(), true);
    return j ? parseLive4dSg(j, iso) : null;
  } catch { return null; }
}
/** Build a fresh snapshot (parallel upstream fetches). */
export async function buildSnapshot(): Promise<Snapshot> {
  const today = myDate(0);
  const yest = myDate(-1);
  const [home, east, sg, feed, perToday, perYest, h15, h19, h15y, h19y, gdSix, nineOfficial, sgLive4d] = await Promise.all([
    get("https://live4dresult.net/"),
    get("https://live4dresult.net/sabah-sarawak-4d-results/"),
    get("https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/fourd_result_top_draws_en.html?v=" + singaporeArchiveVersion()),
    get("https://www.live4d2u.net/liveosx.json?ts=" + Date.now(), true),
    get(`https://www.perdana4d.com/Results/4D?processDate=${today.iso}`),
    get(`https://www.perdana4d.com/Results/4D?processDate=${yest.iso}`),
    hariFor("15:30", today.iso, today.noPad),
    hariFor("19:30", today.iso, today.noPad),
    hariFor("15:30", yest.iso, yest.noPad),
    hariFor("19:30", yest.iso, yest.noPad),
    gdSixToday(today.iso),
    nineOfficialToday(today.iso),
    live4dSgToday(today.iso),
  ]);

  // Prefer direct/current feeds over the cloned home page.
  // The home page can publish Nine Lotto specials before its main prizes.
  const sgOfficial = parseSingapore(sg);
  const liveCards = parseLiveFeed(feed);
  const cards = { ...parseCards(home), ...parseCards(east), ...sgOfficial, ...liveCards };
  // Singapore sources can arrive out of order. Use the newest dated result and
  // merge same-date fields so an older archive never overwrites a live draw.
  const sgDate = (v?: Record<string, string>): number => {
    const m = /(\d{2})-(\d{2})-(\d{4})/.exec(v?.date || "");
    return m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : 0;
  };
  // Same-date priority: official Singapore Pools > live4d2u > Live4D.sg. Live4D.sg can publish early but may still hold temporary numbers.
  const sgParts = [sgLive4d, liveCards["table-11"], sgOfficial["table-11"]].filter(Boolean) as Record<string, string>[];
  if (sgParts.length) {
    const newest = Math.max(...sgParts.map((p) => sgDate(p)));
    const chosen = sgParts.filter((p) => sgDate(p) === newest).reduce((acc, p) => ({ ...acc, ...p }), {});
    const finalSg = { ...(cards["table-11"] || {}), ...chosen };
    // Live4D.sg publishes the new draw before it knows the official draw
    // number. Never keep the previous draw's number with the new date.
    if (!chosen.draw_no && newest > Math.max(0, ...sgParts.filter((p) => sgDate(p) < newest).map((p) => sgDate(p)))) {
      finalSg.draw_no = "----";
    }
    cards["table-11"] = finalSg;
  }
  if (nineOfficial.four) cards["table-17"] = { ...(cards["table-17"] || {}), ...nineOfficial.four };

  const perdana: Record<string, PrizeSet | null> = { "15:30": null, "19:30": null };
  for (const [html, d] of [[perToday, today], [perYest, yest]] as [string | null, { iso: string; noPad: string }][]) {
    if (!html) continue;
    const sets = parsePerdana(html, d.iso);
    for (const time of ["15:30", "19:30"]) {
      const s = sets[time];
      if (hasAnyNumber(s) && !perdana[time]) perdana[time] = s;
    }
  }

  // Official page first, then the reader, then the shared live feed - so a
  // draw is shown as soon as any of them has it.
  if (!perdana["15:30"] || !perdana["19:30"]) {
    const relayed = await perdanaFromRelay(today.iso);
    for (const time of ["15:30", "19:30"]) if (!perdana[time] && relayed[time]) perdana[time] = relayed[time];
  }
  // The operator page for Perdana is unreachable (server timeout, no CORS), so
  // fill anything still empty from the shared live feed instead of leaving the
  // page showing an old stored card.
  // Official draws collected by the GitHub job, for hosts that cannot reach
  // perdana4d.com themselves.
  const fileDays = (perdanaOfficial as unknown as { days?: Record<string, Record<string, PrizeSet>> }).days || {};
  for (const [time, set] of Object.entries(fileDays[today.iso] || {})) {
    if (!perdana[time] && set && set.prize.length && set.prize.some((v) => !isDash(v))) {
      perdana[time] = { ...set, date: weekdayOf(today.iso) };
    }
  }
  const feedPerdana = perdanaFromFeed(feed);
  for (const t of ["15:30", "19:30"]) if (!perdana[t] && feedPerdana[t]) perdana[t] = feedPerdana[t];

  const snap: Snapshot = {
    at: Date.now(), cards, perdana,
    hari: { "15:30": h15 || h15y, "19:30": h19 || h19y },
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
export async function getSnapshot(): Promise<Snapshot> {
  startWarmer();
  const cached = cache;
  if (cached && Date.now() - cached.at < SNAPSHOT_TTL) return cached;
  if (cached) {
    if (!warming) {
      warming = true;
      void buildSnapshot().catch(() => {}).finally(() => { warming = false; });
    }
    return cached;
  }
  // Nothing cached yet (first request after a restart): wait for one build.
  warming = true;
  try { return await buildSnapshot(); } finally { warming = false; }
}

export function startWarmer() {
  if (warmer) return;
  warmer = setInterval(() => { void buildSnapshot().catch(() => {}); }, SNAPSHOT_TTL);
  (warmer as unknown as { unref?: () => void }).unref?.();
}
