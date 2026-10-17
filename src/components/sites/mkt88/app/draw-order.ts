import { overridesFor, type Snap } from "./snapshot-values";

/** Draw-slot ordering helpers for the two-draws-a-day games (Perdana, Lucky HariHari). */

/**
 * True while the 7:30pm draw is the current one.
 *
 * That is from 7:30pm through to the next day's 3:30pm draw - not to midnight.
 * This used to test `mins >= 19:30` alone, so the order flipped back at 00:00,
 * putting the 3:30 card on top many hours before the next 3:30 result existed,
 * with the previous morning's numbers sitting above last night's.
 */
export function nightDrawFirst(now: Date = new Date()): boolean {
  const ms = now.getTime() + 8 * 60 * 60 * 1000; // Malaysia = UTC+8
  const d = new Date(ms);
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  return mins >= 19 * 60 + 30 || mins < 15 * 60 + 30;
}

export const PERDANA_1930 = "table-16-2026-09-06-1930";
export const PERDANA_1530 = "table-16-2026-09-06-1530";
export const HARI_1530 = "table-15-2026-09-06-1530";
export const HARI_1530_6D = "table-15-2026-09-06-1530-6d";
export const HARI_1930 = "table-15-2026-09-06-1930";
export const HARI_1930_6D = "table-15-2026-09-06-1930-6d";

/**
 * Perdana: two draws a day again.
 *
 * The operator dropped the 3:30PM draw on 1 Oct 2026 so only the 7:30PM card was
 * placed; it was resumed on 12 Oct 2026 (the operator's own page carries both
 * times again), so the 3:30PM card is back and ordered like HariHari's - the
 * draw we are waiting for / that just came out sits on top.
 */
export function perdanaIds(night: boolean = nightDrawFirst()): string[] {
  return night ? [PERDANA_1930, PERDANA_1530] : [PERDANA_1530, PERDANA_1930];
}

/** HariHari: each draw time keeps its 4D result directly above its 6D result. */
export function hariIds(night: boolean): string[] {
  const early = [HARI_1530, HARI_1530_6D];
  const late = [HARI_1930, HARI_1930_6D];
  return night ? [...late, ...early] : [...early, ...late];
}

/** "dd-mm-yyyy (Wed)" -> a sortable value, 0 when the date is unknown. */
export function drawDayOf(label?: string): number {
  const m = /(\d{2})-(\d{2})-(\d{4})/.exec(label || "");
  return m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : 0;
}

type Slot = { day: number; ready: boolean };

/** The draw a slot's card is showing, and whether its board has numbers yet. */
function slotState(snap: Snap | undefined, id: string, cls: string): Slot {
  const ov = overridesFor(snap || {}, id, cls);
  const prizes = ov.prizeSet ? ov.prizeSet.prize : [];
  return {
    day: drawDayOf(ov.values ? ov.values.date : undefined),
    ready: prizes.some((v) => !!v && !/^----+$/.test(v)),
  };
}

/**
 * Which draw sits on top: the one whose draw is today's.
 *
 * The owner's rule (17 Oct 2026): the 3:30 column moves to the top once the
 * 3:30 draw is under way, and the 7:30 column moves up when its draw starts.
 * That is a date question, not a "has a number yet" one - Perdana can still be
 * revealing its 3:30 board when the card must already sit on top (reported
 * 17 Oct 2026 at 16:00: 3:30 was under way, its board still empty, and the
 * column stayed below yesterday's 7:30). Both draws for the same day means the
 * later session first; with no date at all the clock decides.
 */
export function newestDrawFirst(early: Slot, late: Slot, clockNight: boolean): boolean {
  if (early.day || late.day) return late.day >= early.day;
  return clockNight;
}

export function perdanaNightFirst(snap: Snap | undefined, clockNight: boolean): boolean {
  return newestDrawFirst(
    slotState(snap, PERDANA_1530, "table-16"),
    slotState(snap, PERDANA_1930, "table-16"),
    clockNight,
  );
}

export function hariNightFirst(snap: Snap | undefined, clockNight: boolean): boolean {
  return newestDrawFirst(
    slotState(snap, HARI_1530, "table-15"),
    slotState(snap, HARI_1930, "table-15"),
    clockNight,
  );
}
