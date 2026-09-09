import raw from "./past-dates.json";

interface PastEntry {
  html: string;
  defaultView: "my" | "kh";
  khHtml?: string;
}

const parsed = raw as unknown as { dates: string[]; entries: Record<string, PastEntry> };

function todayIso(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  } catch {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
}

// Keep the stored history, and always include the latest date (today) so the
// newest results are reachable from the past-results calendar/next button.
function buildDates(): string[] {
  const dates = parsed.dates.slice();
  const today = todayIso();
  if (!today) return dates;
  const last = dates[dates.length - 1];
  const start = last && last < today ? new Date(last + "T12:00:00") : new Date(today + "T12:00:00");
  if (!last || today <= last) return dates;
  const d = new Date(start);
  const iso = (dt: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate());
  };
  d.setDate(d.getDate() + 1);
  while (iso(d) <= today) {
    dates.push(iso(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export const PAST_DATES: string[] = buildDates();

export const DEFAULT_PAST_DATE: string = parsed.dates[parsed.dates.length - 1];

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
