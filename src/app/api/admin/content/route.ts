import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "../../../../lib/auth";
import { getSiteContent, saveSiteContent } from "../../../../lib/site-store";

async function isAuthed(): Promise<boolean> {
  const store = await cookies();
  return verifyToken(store.get(COOKIE_NAME)?.value);
}

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await getSiteContent());
}

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const next = await saveSiteContent(body as never);
    return NextResponse.json(next);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
