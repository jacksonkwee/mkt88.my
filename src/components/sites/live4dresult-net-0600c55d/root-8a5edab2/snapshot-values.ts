/**
 * Which live values belong on which card.
 *
 * This is plain data work with no React in it, so both the client components
 * (the phone pager, the per-game columns) and the server-rendered desktop grid
 * can use it. It lives outside use-live-snapshot.ts because that file is a
 * client module, and a server component cannot call into one.
 */

export type PrizeSet = { prize: string[]; special: string[]; cons: string[]; date?: string; drawNo?: string };
export type HariEntry = { set?: PrizeSet | null; six?: { main: string; subs: Record<string, string> } | null; jp?: Record<string, string> | null } | null;
export type SixEntry = { main: string; subs: Record<string, string>; date?: string } | null;
export type Snap = {
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

/** Values / prize set that should be rendered for one card. */
export function overridesFor(snap: Snap, cardId: string, tableCls: string): { values?: Record<string, string>; prizeSet?: PrizeSet | null } {
  // "mkt-static" marks a card whose numbers are final (Singapore Toto) - it is
  // not part of the snapshot's key, which is the table class alone.
  const cls = (tableCls || "").replace("card outer-box ", "").replace(" mkt-static", "").replace(" six-jp", "").trim();
  const cleanCardId = cardId.replace(/-jp$/, "");
  const values: Record<string, string> = { ...((snap.cards && snap.cards[cls]) || {}) };

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
    if (set && awaitingToday(t, set.date)) return { values: { date: myClock().label }, prizeSet: blankSet() };
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
