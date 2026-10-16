/** Draw-slot ordering helpers for the two-draws-a-day games (Lucky HariHari). */

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
