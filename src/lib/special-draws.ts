import { getSiteContent } from "./site-store";

/**
 * Draw dates the operators announce on top of the normal weekly pattern.
 *
 * The draw-schedule page lists them for players, the result reminder reads the
 * same list so an extra Tuesday draw is announced like any other draw (asked
 * for 13 Oct 2026), and the phone app lays its special-draw alarms from it.
 *
 * The dates themselves are edited in /admin ("Special draw dates") and stored
 * with the rest of the site settings, so a new date works without a code change
 * (asked for 15 Oct 2026). Until one is saved there, the defaults in
 * lib/site-store.ts are used.
 */
export async function getSpecialDrawDates(): Promise<string[]> {
  const content = await getSiteContent();
  const list = Array.isArray(content.specialDraws) ? content.specialDraws : [];
  const clean = list.map((d) => String(d || "").trim()).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  return [...new Set(clean)].sort();
}

/** Magnum 4D, Da Ma Cai 1+3D / 3+3D, Sports Toto 4D, Sabah 88, Cash Sweep, Sandakan. */
export const SPECIAL_DRAW_TABLES = [
  "table-1",
  "table-4",
  "table-5",
  "table-6",
  "table-8",
  "table-9",
  "table-10",
];
