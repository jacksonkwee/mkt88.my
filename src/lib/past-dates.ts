/**
 * Which calendar dates actually hold past results.
 *
 * The Malaysia / Singapore / East Malaysia archive only publishes a date once
 * its cards exist, so the available dates are discovered by checking the
 * archive itself (cached, in memory). Cambodia results are kept by our own API
 * for every past day.
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * Verified Malaysia / Singapore / East Malaysia archive dates and the cards
 * each date carries. Used until the background scan refreshes the cache.
 */
const MY_KNOWN_TABLES: Record<string, string[]> = {
  "2026-08-12": ["table-1", "table-10", "table-11", "table-2", "table-3", "table-4", "table-5", "table-6", "table-7", "table-8", "table-9"],
  "2026-08-15": ["table-1", "table-10", "table-11", "table-2", "table-3", "table-4", "table-5", "table-6", "table-7", "table-8", "table-9"],
  "2026-08-16": ["table-1", "table-10", "table-11", "table-2", "table-3", "table-4", "table-5", "table-6", "table-7", "table-8", "table-9"],
  "2026-08-19": ["table-1", "table-10", "table-11", "table-2", "table-3", "table-4", "table-5", "table-6", "table-7", "table-8", "table-9"],
  "2026-08-22": ["table-1", "table-10", "table-11", "table-2", "table-3", "table-4", "table-5", "table-6", "table-7", "table-8", "table-9"],
  "2026-08-23": ["table-1", "table-10", "table-11", "table-2", "table-3", "table-4", "table-5", "table-6", "table-7", "table-8", "table-9"],
  "2026-08-26": ["table-1", "table-10", "table-11", "table-2", "table-3", "table-4", "table-5", "table-6", "table-7", "table-8", "table-9"],
  "2026-08-29": ["table-1", "table-10", "table-11", "table-2", "table-3", "table-4", "table-5", "table-6", "table-7", "table-8", "table-9"],
  "2026-08-30": ["table-1", "table-10", "table-11", "table-2", "table-3", "table-4", "table-5", "table-6", "table-7", "table-8", "table-9"],
  "2026-09-01": ["table-1", "table-10", "table-2", "table-3", "table-4", "table-5", "table-6", "table-7", "table-8", "table-9"],
  "2026-09-02": ["table-1", "table-10", "table-11", "table-2", "table-3", "table-4", "table-5", "table-6", "table-7", "table-8", "table-9"],
  "2026-09-05": ["table-1", "table-10", "table-11", "table-2", "table-3", "table-4", "table-5", "table-6", "table-7", "table-8", "table-9"],
  "2026-09-06": ["table-1", "table-10", "table-11", "table-2", "table-3", "table-4", "table-5", "table-6", "table-7", "table-8", "table-9"],
  "2026-09-09": ["table-1", "table-10", "table-11", "table-2", "table-3", "table-4", "table-5", "table-6", "table-7", "table-8", "table-9"],
};

/** Oldest day the Cambodia archive answers for. */
const KH_FIRST_DATE = "2026-08-18";

/** How far back the archive is scanned for Malaysia / Singapore dates. */
const MY_SCAN_DAYS = 31;

const CARD_RE = /card outer-box (table-[0-9]+)"/g;

const pad = (n: number) => String(n).padStart(2, "0");

function todayIso(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  } catch {
    const d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
}

function shiftIso(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function range(from: string, to: string): string[] {
  const out: string[] = [];
  let d = from;
  let guard = 0;
  while (d <= to && guard++ < 400) { out.push(d); d = shiftIso(d, 1); }
  return out;
}

function tablesIn(html: string): string[] {
  const out = new Set<string>();
  CARD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CARD_RE.exec(html))) out.add(m[1]);
  return [...out];
}

let myTables: Record<string, string[]> | null = null;
let myScan: Promise<void> | null = null;
const MY_TTL = 6 * 60 * 60 * 1000;
let myAt = 0;

async function cardsOn(date: string): Promise<string[] | null> {
  try {
    const res = await fetch("https://live4dresult.net/past-results/" + date, {
      headers: { "User-Agent": UA, Accept: "*/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const tables = tablesIn(await res.text());
    return tables.length ? tables : null;
  } catch {
    return null;
  }
}

function knownTables(before: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [d, t] of Object.entries(MY_KNOWN_TABLES)) if (d < before) out[d] = t;
  return out;
}

async function scanMyDates(): Promise<void> {
  const today = todayIso();
  const candidates = range(shiftIso(today, -MY_SCAN_DAYS), shiftIso(today, -1));
  const found = await Promise.all(candidates.map(async (d) => [d, await cardsOn(d)] as const));
  // Union with the verified list: a single slow or blocked request must never
  // drop a date that is known to hold results.
  const map: Record<string, string[]> = { ...knownTables(today) };
  for (const [d, t] of found) if (t) map[d] = t;
  myTables = map;
  myAt = Date.now();
}

/**
 * The archive dates plus the cards each one carries.
 *
 * Never blocks a page render: the verified list answers straight away while a
 * fresh archive scan refreshes the cache in the background for later visits.
 */
export async function getPastDateLists(): Promise<{ my: string[]; kh: string[]; myTables: Record<string, string[]> }> {
  const today = todayIso();
  const served = myTables && Date.now() - myAt < MY_TTL ? myTables : knownTables(today);
  if ((!myTables || Date.now() - myAt >= MY_TTL) && !myScan) {
    myScan = scanMyDates().catch(() => {}).finally(() => { myScan = null; });
  }
  return { my: Object.keys(served).sort(), kh: getKhPastDates(), myTables: served };
}

/** Dates that carry Cambodia result cards. */
export function getKhPastDates(): string[] {
  const today = todayIso();
  const last = shiftIso(today, -1);
  if (last < KH_FIRST_DATE) return [];
  return range(KH_FIRST_DATE, last);
}

export function formatPastDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  const dt = new Date(iso + "T12:00:00");
  const wk = Number.isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US", { weekday: "short" });
  return d + "-" + m + "-" + y + (wk ? " (" + wk + ")" : "");
}
