import { NextResponse } from "next/server";
import { checkAndPush } from "../../../../lib/push-notify";
import { pushConfigured, pushDiagnostics } from "../../../../lib/fcm";

/**
 * Send the "result is out" pushes for any draw that has just finished.
 *
 * /api/home-live calls this by itself as it is polled, so in normal use nothing
 * has to hit this route. It is here for checking the wiring after the Firebase
 * project is connected: `?force=1` skips the throttle. Sending a push to every
 * phone is not something a stranger should be able to trigger, so `force` also
 * has to carry the PUSH_TICK_KEY when that variable is set.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const key = process.env.PUSH_TICK_KEY || "";
  if (force && key && url.searchParams.get("key") !== key) {
    return NextResponse.json({ ok: false, reason: "bad key" }, { status: 403 });
  }
  if (!pushConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      env: pushDiagnostics(),
      note: "Set FIREBASE_SERVICE_ACCOUNT on Vercel (Production) and redeploy.",
    });
  }
  const result = await checkAndPush({ force });
  return NextResponse.json({ ok: true, ...result });
}
