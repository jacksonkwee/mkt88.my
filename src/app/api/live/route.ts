import { NextRequest, NextResponse } from "next/server";

const ALLOWED = [
  "live4dresult.net",
  "www.live4dresult.net",
  "perdana4d.com",
  "www.perdana4d.com",
  "hari4d.com",
  "www.hari4d.com",
  "api.hari4d.com",
  "magnum4d.my",
  "www.magnum4d.my",
  "damacai.com.my",
  "www.damacai.com.my",
  "sportstoto.com.my",
  "www.sportstoto.com.my",
  "singaporepools.com.sg",
  "www.singaporepools.com.sg",
  "stc4d.com",
  "www.stc4d.com",
  "cashsweep.my",
  "www.cashsweep.my",
  "diriwan88.com",
  "www.diriwan88.com",
  "gdlotto.net",
  "www.gdlotto.net",
  "9lotto.com",
  "www.9lotto.com",
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return NextResponse.json({ error: "missing url" }, { status: 400 });
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return NextResponse.json({ error: "bad url" }, { status: 400 });
  }
  if (!ALLOWED.includes(url.hostname) || !["http:", "https:"].includes(url.protocol)) {
    return NextResponse.json({ error: "host not allowed" }, { status: 403 });
  }
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": UA, Accept: "*/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return NextResponse.json({ error: "upstream " + res.status }, { status: 502 });
    const text = await res.text();
    return new NextResponse(text, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
