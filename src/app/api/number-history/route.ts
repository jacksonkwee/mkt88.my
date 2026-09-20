import { NextRequest, NextResponse } from "next/server";
import { PAST_DATES, getPastEntry } from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/past-data";
import { toLocal } from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/site-paths";
import {
  DB, PRIZE_NAMES, hitsFromDbMany, hitsFromHtmlMany, regionOf,
  fmtIso, todayIso, epochDay, isoFromEpoch, type RawHit,
} from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/number-history/engine";

export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const SG_LOGO = "/sites/live4dresult-net-0600c55d/root-8a5edab2/logo_singapore4d.png";
const MAX_NUMS = 60;

/** Ten minutes: one upstream fetch per date, reused by every lookup. */
const PAGE_TTL = 10 * 60 * 1000;
/** Big enough to hold the whole un-archived window plus the homepage. */
const PAGE_CACHE_MAX = 90;

const pageCache = new Map<string, { at: number; html: string }>();
async function fetchHtml(url: string): Promise<string> {
  const hit = pageCache.get(url);
  if (hit && Date.now() - hit.at < PAGE_TTL) return hit.html;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" }, cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!res.ok) return "";
    const html = await res.text();
    pageCache.set(url, { at: Date.now(), html });
    while (pageCache.size > PAGE_CACHE_MAX) {
      const first = pageCache.keys().next().value;
      if (!first) break;
      pageCache.delete(first);
    }
    return html;
  } catch {
    return "";
  }
}

/** How far back the on-demand window may reach, so a stale archive cannot
 *  turn one lookup into hundreds of upstream fetches. */
const GAP_LIMIT_DAYS = 120;

/** Dates the offline archive cannot answer for: its own last day backwards. */
function gapDates(today: string): string[] {
  const todayDay = epochDay(today);
  const from = Math.max(epochDay(DB.meta.to) + 1, todayDay - GAP_LIMIT_DAYS);
  const out: string[] = [];
  for (let d = from; d <= todayDay; d++) out.push(isoFromEpoch(d));
  return out;
}

/** Run fn over items with a bounded number of requests in flight. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const k = next++;
      out[k] = await fn(items[k]);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Pull the requested 4-digit numbers out of ?num= / ?nums= (comma or space separated). */
function parseNums(req: NextRequest): string[] {
  const sp = req.nextUrl.searchParams;
  const parts = [...sp.getAll("num"), ...sp.getAll("nums")].join(",").split(/[,\s]+/);
  const seen = new Set<string>();
  for (const p of parts) {
    const v = p.trim();
    if (/^\d{4}$/.test(v)) seen.add(v);
    if (seen.size >= MAX_NUMS) break;
  }
  return [...seen];
}

export interface ApiMatch {
  date: string;
  game: string;
  logo: string;
  region: string;
  prize: string;
  num: string;
}

export async function GET(req: NextRequest) {
  const nums = parseNums(req);
  if (!nums.length) return NextResponse.json({ nums: [], num: "", matches: [], total: 0 });
  const numSet = new Set(nums);

  const map = new Map<string, ApiMatch>();
  const add = (h: RawHit) => {
    const date = fmtIso(h.date);
    const key = date + "|" + h.game + "|" + h.prize + "|" + h.num;
    if (map.has(key)) return;
    let logo = h.logo;
    if (!logo && /singapore/i.test(h.game)) logo = SG_LOGO;
    map.set(key, { date, game: h.game, logo: toLocal(logo), region: regionOf(h.table), prize: h.prize, num: h.num });
  };

  // 1) Offline database of archived draws (all years the source keeps).
  for (const h of hitsFromDbMany(numSet)) add(h);

  // 2) Stored local snapshots (adds games the archive omits, e.g. Nine Lotto,
  //    plus any extra Cambodia draw times captured from official pages).
  const today = todayIso();
  for (const iso of PAST_DATES) {
    if (iso > today) continue;
    const e = getPastEntry(iso);
    if (!e) continue;
    const sources = [e.html, e.khHtml].filter(Boolean) as string[];
    for (const src of sources) for (const h of hitsFromHtmlMany(src, numSet, iso)) add(h);
  }

  // 3) The current live homepage (freshly drawn numbers appear instantly).
  const home = await fetchHtml("https://live4dresult.net/");
  if (home) for (const h of hitsFromHtmlMany(home, numSet, today)) add(h);

  // 4) Every date the offline archive cannot answer for.
  //    This used to look at only the last three days, which left a hole: the
  //    archive stops at DB.meta.to, so everything drawn between that date and
  //    three days ago was missing from Number History.
  const pages = await mapLimit(gapDates(today), 6, async (d) =>
    [d, await fetchHtml("https://live4dresult.net/past-results/" + d)] as const
  );
  for (const [iso, html] of pages) {
    if (html) for (const h of hitsFromHtmlMany(html, numSet, iso)) add(h);
  }

  const matches = [...map.values()].sort((a, b) => {
    const ia = a.date.slice(6, 10) + a.date.slice(3, 5) + a.date.slice(0, 2);
    const ib = b.date.slice(6, 10) + b.date.slice(3, 5) + b.date.slice(0, 2);
    return ib.localeCompare(ia) || a.num.localeCompare(b.num) || a.game.localeCompare(b.game);
  });
  const perNum: Record<string, number> = {};
  for (const m of matches) perNum[m.num] = (perNum[m.num] || 0) + 1;
  return NextResponse.json({
    nums,
    num: nums[0],
    matches,
    total: matches.length,
    perNum,
    dbDays: DB.meta.days,
    dbFrom: DB.meta.from,
    dbTo: DB.meta.to,
    dbBuilt: DB.meta.built,
    prizes: PRIZE_NAMES,
  });
}
