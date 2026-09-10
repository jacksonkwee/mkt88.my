import { NextRequest, NextResponse } from "next/server";
import { PAST_DATES, getPastEntry } from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/past-data";
import { toLocal } from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/site-paths";
import {
  DB, PRIZE_NAMES, hitsFromDbMany, hitsFromHtmlMany, regionOf,
  fmtIso, todayIso, type RawHit,
} from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/number-history/engine";

export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const SG_LOGO = "/sites/live4dresult-net-0600c55d/root-8a5edab2/logo_singapore4d.png";
const MAX_NUMS = 60;

const pageCache = new Map<string, { at: number; html: string }>();
async function fetchHtml(url: string): Promise<string> {
  const hit = pageCache.get(url);
  if (hit && Date.now() - hit.at < 90000) return hit.html;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" }, cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!res.ok) return "";
    const html = await res.text();
    pageCache.set(url, { at: Date.now(), html });
    if (pageCache.size > 15) {
      const first = pageCache.keys().next().value;
      if (first) pageCache.delete(first);
    }
    return html;
  } catch {
    return "";
  }
}

function isoAgo(days: number): string {
  const t = new Date();
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - days)).toISOString().slice(0, 10);
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

  // 4) Recent archive dates so the newest published draws are always included,
  //    even after the homepage moves on to a newer draw date.
  for (let ago = 0; ago <= 2; ago++) {
    const iso = isoAgo(ago);
    const html = await fetchHtml("https://live4dresult.net/past-results/" + iso);
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
