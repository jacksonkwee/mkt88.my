import { NextRequest, NextResponse } from "next/server";
import dict from "../../../components/dabogong-dict.json";

/**
 * 大伯公 千字图 / 万字图 look-up.
 * A 3-digit number maps to a 大伯公千字图 picture, a 4-digit number maps to a
 * 万字图 picture. The keyword + meaning come from a dictionary bundled with the
 * site, so the look-up is instant and has no external dependency.
 */
export const dynamic = "force-dynamic";

const DB = dict as unknown as { e: Record<string, [string, string]> };

function imageFor(num: string): string {
  return num.length === 4
    ? `https://repo2.4dmanager.net/wzt/${num}.jpg`
    : `https://repo2.4dmanager.net/qzt/tpk/${num}.png`;
}

function kindFor(num: string): string {
  return num.length === 4 ? "万字图" : "大伯公千字图";
}

export async function GET(req: NextRequest) {
  const num = (req.nextUrl.searchParams.get("num") || "").trim();
  if (!/^\d{3,4}$/.test(num)) {
    return NextResponse.json({ error: "Enter a 3 or 4 digit number" }, { status: 400 });
  }
  const e = DB.e[num];
  return NextResponse.json({
    num,
    kind: kindFor(num),
    keyword: e ? e[0] : "",
    meaning: e ? e[1] : "",
    image: imageFor(num),
    found: Boolean(e),
  });
}
