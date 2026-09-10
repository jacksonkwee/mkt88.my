import { NextRequest, NextResponse } from "next/server";
import { getViewHtml } from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/past-data";
import { rewriteHtml, stripAdHtml } from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/site-paths";
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
    let source = stored;
    if (!source) {
      try {
        source = await httpGet("https://live4dresult.net/past-results/" + date);
      } catch {
        source = fallback;
      }
    }
    if (!source) source = fallback;

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

    return NextResponse.json({ date, html: cleanFetchedHtml(content) });
  } catch (e) {
    return NextResponse.json({ date, html: "", error: String(e) });
  }
}