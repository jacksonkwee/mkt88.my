/** Which result cards belong to one game on the Malaysia / Singapore archive. */
export const GAME_TABLES: Record<string, string[]> = {
  magnum: ["table-1", "table-3", "table-2"],
  damacai: ["table-4", "table-5"],
  sportstoto: ["table-6", "table-7"],
  sg: ["table-11"],
  sandakan: ["table-8"],
  cashsweep: ["table-9"],
  sabah88: ["table-10"],
  east: ["table-8", "table-9", "table-10"],
  // The home page grid - every card it shows.
  home: ["table-1", "table-2", "table-3", "table-4", "table-5", "table-6", "table-7", "table-8", "table-9", "table-10", "table-11"],
};

/**
 * Cambodia games did not all run for the whole archive period, so each one
 * lists only the dates it actually covered (from the official feeds).
 */
export const KH_AVAILABILITY: Record<string, [string, string][]> = {
  "grand-dragon": [["2021-09-14", "2999-12-31"]],
  "nine-lotto": [["2023-01-01", "2999-12-31"]],
  perdana: [["2025-09-01", "2999-12-31"]],
  "lucky-harihari": [["2021-09-14", "2999-12-31"]],
};

export function khDateAllowed(slug: string, date: string): boolean {
  const spans = KH_AVAILABILITY[slug];
  if (!spans) return true;
  return spans.some(([from, to]) => date >= from && date <= to);
}
