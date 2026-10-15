import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "../../../../lib/auth";
import { tokenKey } from "../../../../lib/fcm";
import { notifyOwner, ownerDeviceIds, setOwnerDevice } from "../../../../lib/owner-alerts";

async function isAuthed(): Promise<boolean> {
  const store = await cookies();
  return verifyToken(store.get(COOKIE_NAME)?.value);
}

/**
 * Which phones get the "a live source broke" push - the owner's own devices.
 *
 * Behind the admin login on purpose: these alerts must never reach users, and a
 * switch in the app that anyone could flip would do exactly that. Open this page
 * IN the app, log in, and the phone registers itself.
 */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const token = new URL(req.url).searchParams.get("token") || "";
  const ids = await ownerDeviceIds();
  return NextResponse.json({
    devices: ids.length,
    thisDevice: !!token && ids.includes(tokenKey(token)),
  });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { token?: string; on?: boolean; test?: boolean };
  /*
   * A test push, so the owner can prove the alerts reach their phone TODAY
   * instead of waiting for a source to break.
   */
  if (body.test) {
    const r = await notifyOwner("✅ MKT88 测试通知", "如果你看到这条，管理员来源警报已经接好了。", "/admin");
    return NextResponse.json({ test: true, ...r });
  }
  const token = String(body.token || "").trim();
  if (!token) return NextResponse.json({ error: "this device has no push token - open this page inside the app" }, { status: 400 });
  const on = body.on !== false;
  const ids = await setOwnerDevice(tokenKey(token), on);
  return NextResponse.json({ devices: ids.length, thisDevice: on });
}
