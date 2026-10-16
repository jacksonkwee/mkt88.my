/**
 * Which live values belong on which card.
 *
 * This is plain data work with no React in it, so both the client components
 * (the phone pager, the per-game columns) and the server-rendered desktop grid
 * can use it. It lives outside use-live-snapshot.ts because that file is a
 * client module, and a server component cannot call into one.
 */

export type PrizeSet = { prize: string[]; special: string[]; cons: string[]; date?: string; drawNo?: string; from?: string[] };
export type HariEntry = { set?: PrizeSet | null; six?: { main: string; subs: Record<string, string> } | null; jp?: Record<string, string> | null } | null;
export type SixEntry = { main: string; subs: Record<string, string>; date?: string } | null;
export type Snap = {
  /** When the server built this copy (ms). Absent on the very first render. */
  at?: number;
  cards?: Record<string, Record<string, string>>;
  perdana?: Record<string, PrizeSet | null>;
  hari?: Record<string, HariEntry>;
  gd6?: SixEntry;
  gdjp7?: Record<string, string> | null;
  nine6?: SixEntry;
  nineJp?: Record<string, string> | null;
};

const timeOf = (id: string) => (id.includes("-1930") ? "19:30" : id.includes("-1530") ? "15:30" : "");
const clean = (v?: string | null) => (v && !/^----+$/.test(v.trim()) ? v.trim() : undefined);
const six6 = (v?: string) => (v && !/^----+$/.test(v.trim()) ? v : "----");

/** Malaysia clock: today's card-date label, and minutes since midnight. */
function myClock(): { label: string; minutes: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
    }).formatToParts(new Date());
    const g = (t: string) => parts.find((p) => p.type === t)?.value || "";
    return { label: `${g("day")}-${g("month")}-${g("year")} (${g("weekday")})`, minutes: Number(g("hour")) * 60 + Number(g("minute")) };
  } catch {
    return { label: "", minutes: -1 };
  }
}

const SESSION_MINUTES: Record<string, number> = { "15:30": 15 * 60 + 30, "19:30": 19 * 60 + 30 };

/*
 * True when a draw session's time has come today but the operator has not
 * published it yet.
 *
 * Lucky HariHari and Perdana run fixed sessions (3:30PM / 7:30PM). Until the
 * operator opens the new draw, every source still hands back the previous one,
 * so the card printed yesterday's date and numbers under a heading that says
 * "3:30PM" - which reads as today's result (reported 12 Oct 2026). Once the
 * session's time has passed the card shows today's date and an empty board
 * until the numbers arrive.
 */
function awaitingToday(session: string, date?: string): boolean {
  const at = SESSION_MINUTES[session];
  if (!at || !date) return false;
  const now = myClock();
  if (!now.label || now.minutes < at) return false;
  return date.trim() !== now.label;
}

/** An all-empty board, for a session that is due but not published yet. */
function blankSet(): PrizeSet {
  return { prize: ["----", "----", "----"], special: Array(15).fill("----"), cons: Array(10).fill("----") };
}

/** Write the 6D 2nd-5th rows as "<first half> or <second half>". */
function sixSubs(values: Record<string, string>, subs?: Record<string, string>) {
  if (!subs) return;
  for (const n of [2, 3, 4, 5]) {
    const a = subs["six_" + n + "a"];
    const b = subs["six_" + n + "b"];
    if (!clean(a) && !clean(b)) continue;
    values["six_" + n] = six6(a) + " or " + six6(b);
  }
}

/*
 * What a phone-side source has already put on a card, and when.
 *
 * The server copy a phone polls is a few seconds old. When a phone-side source
 * has just published a number, that older copy still says "----" for the cell -
 * and re-applying it made the number appear, vanish a moment later, and come
 * back on the next sweep (reported 14 Oct 2026).
 *
 * "Not published yet" and "deliberately empty" are both "----", so the only way
 * to tell them apart is WHEN each was written. Every phone-side writer stamps
 * the cell it writes with the moment it wrote it; a copy built BEFORE that
 * moment may not replace or blank that cell. A cell nobody has written - say a
 * leftover from the captured page - carries no stamp, so the clearing the site
 * does today still happens exactly as it does now.
 *
 * Only the four games the user asked for first are covered: Grand Dragon, Nine
 * Lotto, Perdana and Lucky HariHari. Everything else keeps today's behaviour.
 */
export const LIVE_STAMPED_CLASSES = new Set([
  "table-13", "table-14", "table-15", "table-16", "table-17", "table-18",
]);

export const LIVE_ATTR = "data-live-at";

type LiveMark = { v: string; at: number; date: string };

const liveCards = new Map<string, Map<string, LiveMark>>();
/*
 * The same writes again, keyed by where the cell sits (“table index:cell index”
 * among that table's number cells).
 *
 * The prize and special cells of the two-draw games (Perdana, HariHari, and the
 * 6D boards) carry no data-id - the writers fill them by position - so React's
 * render path has nothing to key a live value on. Without this, a re-render put
 * the snapshot's older board back over what the phone had just read.
 */
const liveCells = new Map<string, Map<string, LiveMark>>();

function numberCellKey(el: Element): string {
  const card = el.closest ? el.closest(".card.outer-box") : null;
  const table = el.closest ? el.closest("table") : null;
  if (!card || !table) return "";
  const ti = Array.from(card.querySelectorAll("table")).indexOf(table);
  const n = Array.from(table.querySelectorAll("td.lottery-prize-number, td.lottery-number")).indexOf(el);
  return ti < 0 || n < 0 ? "" : ti + ":" + n;
}

/** The card class ("table-15") a cell belongs to, or "" when it has none. */
export function cardClassOf(el: Element | null): string {
  const card = el && el.closest ? el.closest(".card.outer-box") : null;
  const m = /(?:^|\s)(table-\d+)(?:\s|$)/.exec(card ? String(card.className) : "");
  return m ? m[1] : "";
}

/**
 * Remember a value a phone-side source just wrote, and stamp the time on the
 * cell itself so the inline boot script - which is plain JavaScript - can see
 * it too.
 */
export function markLiveValue(el: Element | null, v: string): void {
  if (!el || typeof el.setAttribute !== "function") return;
  const cls = cardClassOf(el);
  if (!cls || !LIVE_STAMPED_CLASSES.has(cls)) return;
  const at = Date.now();
  el.setAttribute(LIVE_ATTR, String(at));
  const card = el.closest ? el.closest(".card.outer-box") : null;
  const dateEl = card ? card.querySelector('[data-id="date"]') : null;
  const mark: LiveMark = { v, at, date: dateEl ? (dateEl.textContent || "").trim() : "" };
  const id = el.getAttribute("data-id");
  if (id) {
    const vals = liveCards.get(cls) || new Map<string, LiveMark>();
    vals.set(id, mark);
    liveCards.set(cls, vals);
  }
  const key = numberCellKey(el);
  if (key) {
    const cells = liveCells.get(cls) || new Map<string, LiveMark>();
    cells.set(key, mark);
    liveCells.set(cls, cells);
  }
}

/**
 * The value a phone-side source put in this cell of this card.
 *
 * It wins when it belongs to the same draw the copy is showing (the phone read
 * the operator; the copy may not be able to) or when it was written after the
 * copy was built. A copy for a newer draw wins, as it must.
 */
export function liveCellFor(cls: string, tableIndex: number, cellIndex: number, copyDate?: string, copyAt?: number): string | undefined {
  if (!cls || !LIVE_STAMPED_CLASSES.has(cls)) return undefined;
  const hit = liveCells.get(cls)?.get(tableIndex + ":" + cellIndex);
  if (!hit) return undefined;
  const markDay = dayValue(hit.date), copyDay = dayValue(copyDate);
  if (markDay && copyDay && markDay < copyDay) return undefined;
  if (markDay && copyDay) return hit.v;
  return !copyAt || hit.at > copyAt ? hit.v : undefined;
}

/** "dd-mm-yyyy (Wed)" or "yyyy-mm-dd" -> a comparable number, else 0. */
function dayValue(v?: string): number {
  const s = String(v || "").trim();
  const m = /(\d{2})-(\d{2})-(\d{4})/.exec(s);
  if (m) return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return iso ? Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])) : 0;
}

/**
 * May a copy of the snapshot write this cell?
 *
 * A stamped cell holds the operator's own board, read on the phone. For
 * HariHari that is the ONLY reading there is - its API blocks our server - and
 * for the others the phone reads the operator at least as early. So a stamped
 * cell stands, even against a copy built a moment ago: measured 15 Oct 2026,
 * the server copy is rebuilt every second or two with yesterday's HariHari
 * draw still in it, and it put that date and those numbers back over the live
 * ones every single time.
 *
 * The one exception is a copy for a NEWER draw - that is the previous draw's
 * numbers having to go, and it is exactly when the card must move on.
 */
export function copyMayWrite(el: Element | null, copyDate?: string, cardDate?: string): boolean {
  if (!el || typeof el.getAttribute !== "function") return true;
  const at = Number(el.getAttribute(LIVE_ATTR) || 0);
  if (!at) return true;                                       // nothing the phone wrote
  const copyDay = dayValue(copyDate), cardDay = dayValue(cardDate);
  if (copyDay && cardDay && copyDay > cardDay) return true;    // a new draw: take it
  return false;
}

/** The values a phone-side source wrote since this copy was built. */
export function liveValuesFor(cls: string, copyAt?: number): Record<string, string> {
  if (!cls || !LIVE_STAMPED_CLASSES.has(cls) || !copyAt) return {};
  const vals = liveCards.get(cls);
  if (!vals) return {};
  const out: Record<string, string> = {};
  for (const [id, e] of vals) if (e.at > copyAt) out[id] = e.v;
  return out;
}

/** Values / prize set that should be rendered for one card. */
export function overridesFor(snap: Snap, cardId: string, tableCls: string): { values?: Record<string, string>; prizeSet?: PrizeSet | null } {
  // "mkt-static" marks a card whose numbers are final (Singapore Toto) - it is
  // not part of the snapshot's key, which is the table class alone.
  const cls = (tableCls || "").replace("card outer-box ", "").replace(" mkt-static", "").replace(" six-jp", "").replace(" six-one", "").trim();
  const cleanCardId = cardId.replace(/-jp$/, "");
  const values: Record<string, string> = { ...((snap.cards && snap.cards[cls]) || {}) };
  // Anything a phone-side source has written since this copy was built wins
  // over it, so re-rendering the card cannot put the older copy back.
  Object.assign(values, liveValuesFor(cls, snap.at));

  if (cleanCardId.startsWith("table-14")) {
    const g = snap.gd6;
    // Prefer the date that belongs to the draw being shown. The 4D card can
    // already read today before today's 6D is published, which would pair a
    // live date with the previous draw's numbers.
    const gd4 = snap.cards ? snap.cards["table-13"] : null;
    const drawDate: string | undefined = (g && g.date) || (gd4 && gd4.date) || undefined;
    if (drawDate && clean(drawDate)) values.date = drawDate;
    if (g) { if (clean(g.main)) values.six_main = g.main; sixSubs(values, g.subs); }
    if (snap.gdjp7) for (const [k, v] of Object.entries(snap.gdjp7)) { if (clean(v)) values[k] = v; }
    return { values };
  }
  if (cleanCardId.startsWith("table-18")) {
    const nine4 = snap.cards ? snap.cards["table-17"] : null;
    if (nine4 && clean(nine4.date)) values.date = nine4.date;
    const n = snap.nine6;
    if (n) { if (clean(n.main)) values.six_main = n.main; sixSubs(values, n.subs); }
    if (snap.nineJp) for (const [k, v] of Object.entries(snap.nineJp)) { if (clean(v)) values[k] = v; }
    return { values };
  }

  const t = timeOf(cleanCardId);
  if (!t) return { values };

  if (cleanCardId.startsWith("table-16")) {
    const set = snap.perdana ? snap.perdana[t] : null;
    // Keep the jackpot rows (they belong to the card, not to one draw) while the
    // awaited draw's board is still blank.
    if (set && awaitingToday(t, set.date)) return { values: { ...values, date: myClock().label }, prizeSet: blankSet() };
    if (set) { values.date = clean(set.date) || values.date; values.draw_no = clean(set.drawNo) || values.draw_no; return { values, prizeSet: set }; }
  }
  if (cleanCardId.startsWith("table-15")) {
    const h = snap.hari ? snap.hari[t] : null;
    if (h) {
      if (awaitingToday(t, h.set?.date)) {
        const today: Record<string, string> = { date: myClock().label };
        if (cleanCardId.endsWith("-6d")) {
          today.six_main = "----";
          for (const n of [2, 3, 4, 5]) today["six_" + n] = "----";
          return { values: today };
        }
        return { values: today, prizeSet: blankSet() };
      }
      if (h.set) { values.date = clean(h.set.date) || values.date; values.draw_no = clean(h.set.drawNo) || values.draw_no; }
      if (h.six && cleanCardId.endsWith("-6d")) {
        if (clean(h.six.main)) values.six_main = h.six.main;
        for (const [k, v] of Object.entries(h.six.subs || {})) { if (clean(v)) values[k] = v; }
        sixSubs(values, h.six.subs);
      }
      if (h.jp) for (const [k, v] of Object.entries(h.jp)) { if (clean(v)) values[k] = v; }
      if (h.set && !cleanCardId.endsWith("-6d")) return { values, prizeSet: h.set };
    }
  }
  return { values };
}
