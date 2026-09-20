import { NextRequest, NextResponse } from "next/server";
import { PAST_DATES, getPastEntry } from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/past-data";
import { toLocal } from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/site-paths";
import deepRaw from "../../../lib/deep-past.json";
import { DEEP_CARDS } from "../../../lib/deep-past-cards";
import {
  DB, PRIZE_NAMES, hitsFromDbMany, hitsFromHtmlMany, regionOf,
  fmtIso, todayIso, epochDay, isoFromEpoch, type PrizeName, type RawHit,
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

type DeepGame = { n: string; d: string; dn: string; p: [string, string][]; g: [string, string[]][] };
const DEEP = deepRaw as unknown as Record<string, Record<string, DeepGame>>;

/** Deep archive game key -> the card that names, logos and files it. */
const DEEP_DEF: Record<string, { table: string; logo: string; name: string }> = {};
for (const list of Object.values(DEEP_CARDS)) {
  for (const c of list) if (!DEEP_DEF[c.key]) DEEP_DEF[c.key] = { table: c.table, logo: c.logo, name: c.name };
}

const DEEP_PRIZE_RE = /^\s*(1st|2nd|3rd)\b/i;
const DEEP_GROUP_RE = /^\s*(Special|Consolation)\b/i;

/** The date printed on the draw, falling back to the day it is filed under. */
function deepIso(label: string, key: string): string {
  const m = /(\d{2})-(\d{2})-(\d{4})/.exec(label || "");
  if (m) return m[3] + "-" + m[2] + "-" + m[1];
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : "";
}

/**
 * The stored deep archive the game pages already show (2021-09-15 ..
 * 2022-04-20). Number History never looked at it, so every draw in that window
 * - for example Da Ma Cai 6966 on 22-09-2021 - was missing. Only 4-digit
 * prizes count here; the 3D / 5D / 6D rows on the same cards are not 4D draws.
 */
function hitsFromDeepMany(nums: Set<string>): RawHit[] {
  const out: RawHit[] = [];
  for (const [key, games] of Object.entries(DEEP)) {
    for (const [gameKey, g] of Object.entries(games)) {
      const date = deepIso(g.d, key);
      if (!date) continue;
      const day = epochDay(date);
      const def = DEEP_DEF[gameKey];
      const game = def ? def.name : g.n;
      const logo = def ? def.logo : "";
      const table = def ? def.table : "";
      for (const [label, value] of g.p || []) {
        const m = DEEP_PRIZE_RE.exec(label);
        if (m && /^\d{4}$/.test(value)) out.push({ num: value, date, day, game, logo, table, prize: PRIZE_NAMES[Number(m[1][0]) - 1] });
      }
      for (const [label, list] of g.g || []) {
        const m = DEEP_GROUP_RE.exec(label);
        if (!m) continue;
        const prize: PrizeName = /^special/i.test(m[1]) ? "Special" : "Consolation";
        for (const value of list || []) if (/^\d{4}$/.test(value)) out.push({ num: value, date, day, game, logo, table, prize });
      }
    }
  }
  return out.filter((h) => nums.has(h.num));
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

  // 0) The deep archive the game pages already show.
  for (const h of hitsFromDeepMany(numSet)) add(h);

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
