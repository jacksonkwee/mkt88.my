import raw from "./past-dates.json";

interface PastEntry {
  html: string;
  defaultView: "my" | "kh";
  khHtml?: string;
}

const parsed = raw as unknown as { dates: string[]; entries: Record<string, PastEntry> };

export const PAST_DATES: string[] = parsed.dates;

export function getPastEntry(date: string): PastEntry | undefined {
  return parsed.entries[date];
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}-${m}-${y}`;
}

/** Return the HTML for the requested view on a date, or null when unavailable. */
export function getViewHtml(date: string, view: "my" | "kh"): string | null {
  const e = parsed.entries[date];
  if (!e) return null;
  if (view === "kh") {
    return e.khHtml || (e.defaultView === "kh" ? e.html : null);
  }
  return e.defaultView === "my" ? e.html : null;
}

/** Split a captured past-results column into (grid HTML, description HTML). */
export function splitParts(html: string): { grid: string; desc: string } {
  const gridMarker = '<div class="row">';
  const descMarker = '<div class="description">';
  const g = html.indexOf(gridMarker);
  const d = html.indexOf(descMarker);
  if (g === -1) return { grid: "", desc: "" };
  const gridEnd = d === -1 ? html.length : d;
  return { grid: html.slice(g, gridEnd), desc: d === -1 ? "" : html.slice(d) };
}

export function formatDateWithDay(date: string): string {
  const [y, m, d] = date.split("-");
  const dt = new Date(date + "T12:00:00");
  const wk = Number.isNaN(dt.getTime())
    ? ""
    : dt.toLocaleDateString("en-US", { weekday: "short" });
  return `${d}-${m}-${y} (${wk})`;
}
