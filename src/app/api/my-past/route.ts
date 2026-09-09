import { NextRequest, NextResponse } from "next/server";
import https from "https";
import { getViewHtml } from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/past-data";
import { rewriteHtml, stripAdHtml } from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/site-paths";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": UA, Accept: "*/*" }, timeout: 25000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
  });
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  try {
    const stored = getViewHtml(date, "my");
    let html = stored;
    if (!html) {
      // Fetch that day from the live4dresult archive so no Malaysia/Singapore
      // past date is ever blank.
      html = await httpGet("https://live4dresult.net/past-results/" + date);
    }
    const rowStart = html.indexOf('<div id="row">');
    let content = rowStart >= 0 ? html.slice(rowStart) : html;
    const descIdx = content.indexOf('<div class="description">');
    if (descIdx >= 0) content = content.slice(0, descIdx);
    content = stripAdHtml(rewriteHtml(content));
    return NextResponse.json({ date, html: content });
  } catch (e) {
    return NextResponse.json({ date, html: "", error: String(e) });
  }
}
