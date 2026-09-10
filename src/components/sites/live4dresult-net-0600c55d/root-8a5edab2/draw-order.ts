/** Draw-slot ordering helpers for the two-draws-a-day games (Perdana / HariHari). */

/** True from 7:30pm (Malaysia) onwards - the 7:30 draw is then shown first. */
export function nightDrawFirst(now: Date = new Date()): boolean {
  const ms = now.getTime() + 8 * 60 * 60 * 1000; // Malaysia = UTC+8
  const d = new Date(ms);
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  return mins >= 19 * 60 + 30;
}

export const PERDANA_1530 = "table-16-2026-09-06-1530";
export const PERDANA_1930 = "table-16-2026-09-06-1930";
export const HARI_1530 = "table-15-2026-09-06-1530";
export const HARI_1530_6D = "table-15-2026-09-06-1530-6d";
export const HARI_1930 = "table-15-2026-09-06-1930";
export const HARI_1930_6D = "table-15-2026-09-06-1930-6d";

/** Perdana: the draw we are waiting for / just drawn comes first. */
export function perdanaIds(night: boolean): string[] {
  return night ? [PERDANA_1930, PERDANA_1530] : [PERDANA_1530, PERDANA_1930];
}

/** HariHari: each draw time keeps its 4D result directly above its 6D result. */
export function hariIds(night: boolean): string[] {
  const early = [HARI_1530, HARI_1530_6D];
  const late = [HARI_1930, HARI_1930_6D];
  return night ? [...late, ...early] : [...early, ...late];
}
