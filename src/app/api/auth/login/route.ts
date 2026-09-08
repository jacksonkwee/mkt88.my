import { NextRequest, NextResponse } from "next/server";
import { ADMIN_USER, ADMIN_PASSWORD, COOKIE_NAME, createToken } from "../../../../lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { user, password } = (await req.json()) as { user?: string; password?: string };
    if (user === ADMIN_USER && password === ADMIN_PASSWORD) {
      const res = NextResponse.json({ ok: true });
      res.cookies.set(COOKIE_NAME, createToken(), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
      return res;
    }
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
