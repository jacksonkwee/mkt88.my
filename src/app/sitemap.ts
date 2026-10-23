import type { MetadataRoute } from "next";
import { getPastDateLists } from "../lib/past-dates";

const BASE = "https://www.mkt88.my";

/*
 * The sitemap used to be a static file in public/ whose lastmod never moved off
 * 10 Sep 2026, so Google was told the site had not changed in six weeks and
 * stopped coming back. It also listed only the 27 fixed pages, which is why the
 * date-specific result pages - the ones people actually search for - were never
 * discovered.
 *
 * Generated here instead: the live pages carry today's date, and every archived
 * draw date gets its own entry with that date as its lastmod.
 */
const STATIC_PAGES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1.0, changeFrequency: "hourly" },
  { path: "/4dresults", priority: 0.9, changeFrequency: "hourly" },
  { path: "/lotto-4d", priority: 0.9, changeFrequency: "hourly" },
  { path: "/cambodia-4d-results", priority: 0.9, changeFrequency: "hourly" },
  { path: "/sabah-sarawak-4d-results", priority: 0.9, changeFrequency: "daily" },
  { path: "/singapore-4d-results", priority: 0.9, changeFrequency: "daily" },
  { path: "/east/stc", priority: 0.8, changeFrequency: "daily" },
  { path: "/east/sabah88", priority: 0.8, changeFrequency: "daily" },
  { path: "/east/cashsweep", priority: 0.8, changeFrequency: "daily" },
  { path: "/result/magnum", priority: 0.9, changeFrequency: "hourly" },
  { path: "/result/magnum-4d-jackpot", priority: 0.9, changeFrequency: "hourly" },
  { path: "/result/power-toto", priority: 0.9, changeFrequency: "hourly" },
  { path: "/result/sportstoto", priority: 0.9, changeFrequency: "hourly" },
  { path: "/result/damacai", priority: 0.9, changeFrequency: "hourly" },
  { path: "/result/grand-dragon", priority: 0.8, changeFrequency: "hourly" },
  { path: "/result/nine-lotto", priority: 0.8, changeFrequency: "hourly" },
  { path: "/result/perdana", priority: 0.8, changeFrequency: "hourly" },
  { path: "/result/lucky-harihari", priority: 0.8, changeFrequency: "hourly" },
  { path: "/past-results", priority: 0.8, changeFrequency: "daily" },
  { path: "/number-history", priority: 0.9, changeFrequency: "daily" },
  { path: "/dabogong", priority: 0.7, changeFrequency: "monthly" },
  { path: "/draw-schedule", priority: 0.8, changeFrequency: "weekly" },
  { path: "/statistics", priority: 0.7, changeFrequency: "daily" },
  { path: "/favourites", priority: 0.4, changeFrequency: "monthly" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/disclaimer", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy-policy", priority: 0.3, changeFrequency: "yearly" },
];

const asDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({
    url: BASE + p.path,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  // Archived draws never change once published, so each carries its own date
  // rather than "today" - otherwise every URL looks freshly updated every day.
  try {
    const { my, kh } = await getPastDateLists();
    for (const iso of my) {
      entries.push({
        url: `${BASE}/past-results/${iso}`,
        lastModified: asDate(iso),
        changeFrequency: "yearly",
        priority: 0.6,
      });
    }
    for (const iso of kh) {
      entries.push({
        url: `${BASE}/past-results/${iso}/cambodia`,
        lastModified: asDate(iso),
        changeFrequency: "yearly",
        priority: 0.5,
      });
    }
  } catch {
    // A failed archive read must not break the sitemap - the fixed pages above
    // are still valid on their own.
  }

  return entries;
}
