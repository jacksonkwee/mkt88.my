import { NextRequest, NextResponse } from "next/server";
import { getViewHtml } from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/past-data";
import { rewriteHtml, stripAdHtml } from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/site-paths";
import recent from "../my-past/recent.json";
import { GAME_TABLES } from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/game-tables";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";


async function httpGet(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*", "Accept-Encoding": "identity" },
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error("upstream " + res.status);
  return await res.text();
}

/** Balanced <div> slice for class="card outer-box <cls>". */
function extractCard(html: string, cls: string): string {
  const key = '<div class="card outer-box ' + cls + '"';
  const start = html.indexOf(key);
  if (start < 0) return "";
  let i = start;
  let depth = 0;
  while (i < html.length) {
    const open = html.indexOf("<div", i);
    const close = html.indexOf("</div>", i);
    if (close === -1 || (open !== -1 && open < close)) { depth++; i = open + 4; }
    else { depth--; i = close + 6; if (depth === 0) break; }
  }
  return html.slice(start, i);
}

/** Keep the past numbers as printed: no live ids, no live placeholder masking. */
function freeze(html: string): string {
  return rewriteHtml(html)
    // Mark the card as a past result so the page's live refresher never
    // writes today's numbers into it.
    .replace(/class="card outer-box /g, 'class="card outer-box mkt-past ')
    .replace(/\sdata-id=(?:"[^"]*"|'[^']*')/g, "")
    .replace(/\sclass="live-pending"/g, "");
}

async function sourceFor(date: string): Promise<string> {
  const stored = getViewHtml(date, "my");
  if (stored && GAME_TABLES.magnum.some((t) => stored.includes('card outer-box ' + t + '"'))) return stored;
  try {
    return await httpGet("https://live4dresult.net/past-results/" + date);
  } catch {
    return (recent as Record<string, string>)[date] || "";
  }
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const date = req.nextUrl.searchParams.get("date") || "";
  const tables = GAME_TABLES[slug];
  if (!tables) return NextResponse.json({ error: "bad game" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "bad date" }, { status: 400 });

  try {
    const source = await sourceFor(date);
    const blocks = tables.map((t) => extractCard(source, t)).filter(Boolean);
    if (!blocks.length) return NextResponse.json({ slug, date, html: "" }, { headers: { "cache-control": "no-store" } });

    let html = '<div class="row">';
    for (const block of blocks) {
      const cleaned = stripAdHtml(freeze(block));
      html += '<div class="col-12 col-sm-12 col-md-6 col-lg-4 mt-3 px-1">' + cleaned + "</div>";
    }
    html += "</div>";
    return NextResponse.json({ slug, date, html }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ slug, date, html: "", error: String(e) }, { headers: { "cache-control": "no-store" } });
  }
}
