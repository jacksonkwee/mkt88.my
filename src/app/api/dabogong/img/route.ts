import { NextRequest, NextResponse } from "next/server";

/**
 * Image proxy for the 大伯公 千字图 / 万字图 pictures (repo2.4dmanager.net only),
 * so the pictures always load even when the upstream blocks hot-linking.
 */
export const dynamic = "force-dynamic";

const ALLOWED_HOSTS = ["repo2.4dmanager.net"];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u") || "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json({ error: "bad url" }, { status: 400 });
  }
  if (!ALLOWED_HOSTS.includes(url.hostname) || url.protocol !== "https:") {
    return NextResponse.json({ error: "host not allowed" }, { status: 403 });
  }
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": UA, Accept: "image/*,*/*;q=0.8", Referer: "https://4dmanager.net/" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return NextResponse.json({ error: "upstream " + res.status }, { status: 502 });
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "content-type": res.headers.get("content-type") || "image/jpeg",
        "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
