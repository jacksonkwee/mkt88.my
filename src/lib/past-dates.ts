/**
 * Which calendar dates hold past results.
 *
 * Malaysia / Singapore / East Malaysia: the archive only publishes a date once
 * its cards exist, so the full list of published dates was harvested once and
 * stored in my-past-dates.json (725 dates back to 2022-04-20). A short rolling
 * scan keeps newer dates coming.
 *
 * Cambodia: the official feeds answer back to 2021, but not every game ran for
 * the whole period, so each game lists only the range it actually covered.
 */
import myPastRaw from "./my-past-dates.json";
import hariPastRaw from "./hari-past.json";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const MY_BASE = myPastRaw as unknown as {
  from: string;
  to: string;
  dates: string[];
  tables: Record<string, string[]>;
};

/** Oldest Cambodia date offered (matches the reference app). */
export const KH_FIRST_DATE = "2021-09-14";

/** How many recent days the rolling Malaysia scan re-checks. */
const MY_SCAN_DAYS = 45;

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
  while (d <= to && guard++ < 4000) { out.push(d); d = shiftIso(d, 1); }
  return out;
}

function tablesIn(html: string): string[] {
  const out = new Set<string>();
  CARD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CARD_RE.exec(html))) out.add(m[1]);
  return [...out];
}

let myTables: Record<string, string[]> = { ...MY_BASE.tables };
let myScan: Promise<void> | null = null;
let myAt = 0;
const MY_TTL = 3 * 60 * 60 * 1000;

async function cardsOn(date: string): Promise<string[] | null> {
  try {
    const res = await fetch("https://live4dresult.net/past-results/" + date, {
      headers: { "User-Agent": UA, Accept: "*/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const tables = tablesIn(await res.text());
    return tables.length ? tables : null;
  } catch {
    return null;
  }
}

async function scanRecent(): Promise<void> {
  const today = todayIso();
  const candidates = range(shiftIso(today, -MY_SCAN_DAYS), shiftIso(today, -1));
  const found = await Promise.all(candidates.map(async (d) => [d, await cardsOn(d)] as const));
  const map: Record<string, string[]> = { ...myTables };
  for (const [d, t] of found) if (t) map[d] = t;
  myTables = map;
  myAt = Date.now();
}

/**
 * The archive dates plus the cards each one carries. The stored list answers
 * instantly; a rolling scan refreshes newer dates in the background.
 */
export type KhByGame = Record<string, string[]>;

/** HariHari dates we actually hold results for. */
function hariDates(): string[] {
  const store = hariPastRaw as unknown as { days: Record<string, unknown> };
  return Object.keys(store.days).sort();
}

/**
 * Each Cambodia game only lists the dates it really has results for, so a
 * picked date never lands on an empty card.
 */
export function getKhDatesByGame(): KhByGame {
  const last = shiftIso(todayIso(), -1);
  return {
    "grand-dragon": last < "2021-09-14" ? [] : range("2021-09-14", last),
    "nine-lotto": last < "2023-01-01" ? [] : range("2023-01-01", last),
    perdana: last < "2025-09-01" ? [] : range("2025-09-01", last),
    "lucky-harihari": hariDates(),
  };
}

export async function getPastDateLists(): Promise<{ my: string[]; kh: string[]; myTables: Record<string, string[]>; khByGame: KhByGame }> {
  if (!myScan && Date.now() - myAt >= MY_TTL) {
    myScan = scanRecent().catch(() => { }).finally(() => { myScan = null; });
  }
  const khByGame = getKhDatesByGame();
  const kh = [...new Set(Object.values(khByGame).flat())].sort();
  return { my: Object.keys(myTables).sort(), kh, myTables, khByGame };
}

/** Every Cambodia date any game covers. */
export function getKhPastDates(): string[] {
  const last = shiftIso(todayIso(), -1);
  if (last < KH_FIRST_DATE) return [];
  return range(KH_FIRST_DATE, last);
}

export function formatPastDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  const dt = new Date(iso + "T12:00:00");
  const wk = Number.isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US", { weekday: "short" });
  return d + "-" + m + "-" + y + (wk ? " (" + wk + ")" : "");
}
