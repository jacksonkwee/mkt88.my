import { NextRequest, NextResponse } from "next/server";
import { getViewHtml } from "../../../components/sites/mkt88/app/past-data";
import { rewriteHtml, stripAdHtml } from "../../../components/sites/mkt88/app/site-paths";
import { setZodiacImage } from "../../../components/sites/mkt88/app/zodiac";
import { getArchivedPast } from "../../../lib/past-archive";
import { buildLocalPastHtml } from "../../../lib/local-past";
import recent from "./recent.json";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function httpGet(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*", "Accept-Encoding": "identity" },
    redirect: "follow",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("upstream " + res.status);
  return await res.text();
}

const zodiacCache = new Map<string, { at: number; value: string }>();

async function totoZodiac(date: string): Promise<string> {
  const cached = zodiacCache.get(date);
  if (cached && Date.now() - cached.at < 60_000) return cached.value;
  try {
    const live = await fetch("https://www.live4d2u.net/liveosx.json?ts=" + Date.now(), {
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (live.ok) {
      const toto = ((await live.json()) as { T?: { DD?: string; ZODIAC?: string } }).T;
      const image = /zodiac\/([a-z]+)\.png/i.exec(String(toto?.ZODIAC || ""))?.[1]?.toLowerCase();
      if (image && String(toto?.DD || "").includes(date.split("-").reverse().join("-"))) {
        zodiacCache.set(date, { at: Date.now(), value: image });
        return image;
      }
    }
    const res = await fetch("https://api.sportstoto.com.my/api/v1/app/GetResults", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return "";
    const json = (await res.json()) as { "4dResult"?: { DrawDate?: string; Zodiac?: string }[] };
    const draw = (json["4dResult"] || []).find((item) => String(item.DrawDate || "").startsWith(date));
    const value = String(draw?.Zodiac || "").trim().toLowerCase();
    zodiacCache.set(date, { at: Date.now(), value });
    return value;
  } catch {
    return "";
  }
}

/** Keep the result cards even if an ad-removal pass is too aggressive. */
function cleanFetchedHtml(html: string): string {
  const rewritten = rewriteHtml(html);
  const cleaned = stripAdHtml(rewritten);
  if (cleaned.trim().length > 1000) return cleaned;
  return rewritten
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<ins class="adsbygoogle"[^>]*>[\s\S]*?<\/ins>/gi, "")
    .replace(/Advertisements/g, "");
}
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  }

  try {
    const fallback = (recent as Record<string, string>)[date];
    const stored = getViewHtml(date, "my");
    let source: string | null = stored;
    if (!source) {
      const archived = await getArchivedPast(date);
      if (archived) source = archived.html;
    }
    if (!source) source = buildLocalPastHtml(date);
    if (!source) {
      try {
        source = await httpGet("https://live4dresult.net/past-results/" + date);
      } catch {
        source = fallback;
      }
    }
    if (!source) source = fallback;

    // The archive answers every date with *some* page, so make sure the page we
    // got really is the Malaysia / Singapore grid before showing anything.
    if (!/class="card outer-box[^"]*\btable-(?:1|2|3|4|5|6|7|8|9|10|11)\b/.test(source)) source = "";

    // The upstream archive does not always wrap the cards in #row, so start at
    // the first result card when that marker is absent.
    let content = source;
    const rowStart = content.indexOf('<div id="row">');
    if (rowStart >= 0) {
      content = content.slice(rowStart);
    } else {
      const firstCard = content.indexOf('<div class="card outer-box');
      if (firstCard >= 0) content = content.slice(firstCard);
    }

    const descIdx = content.indexOf('<div class="description">');
    if (descIdx >= 0) content = content.slice(0, descIdx);

    let html = cleanFetchedHtml(content);
    if (/\bdata-id=["']zodiac["']/i.test(html)) html = setZodiacImage(html, await totoZodiac(date));
    return NextResponse.json({ date, html });
  } catch (e) {
    return NextResponse.json({ date, html: "", error: String(e) });
  }
}
