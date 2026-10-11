import { NextResponse } from "next/server";
import { firestorePut, pushConfigured, tokenKey } from "../../../../lib/fcm";

/**
 * Register a phone for result push notifications.
 *
 * The app sends its FCM token here the first time it runs (and whenever FCM
 * hands it a new one). The token is stored in Firestore, keyed by a hash of
 * itself so re-registering the same phone updates one document rather than
 * piling up copies. The chosen language rides along, so the push arrives in the
 * language the user picked in Settings.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!pushConfigured()) return NextResponse.json({ ok: false, reason: "push not configured" }, { status: 503 });
  let body: { token?: string; lang?: string; alerts?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad json" }, { status: 400 });
  }
  const token = (body.token || "").trim();
  if (token.length < 20) return NextResponse.json({ ok: false, reason: "no token" }, { status: 400 });
  const lang = ["en", "ms", "zh"].includes(body.lang || "") ? body.lang! : "en";
  const ok = await firestorePut("devices/" + tokenKey(token), {
    token,
    lang,
    // The App's own "result alerts" switch. "0" keeps this phone out of the
    // pushes, so switching the reminder off in the app switches it off here too.
    alerts: body.alerts === false ? "0" : "1",
    updated: new Date().toISOString(),
  });
  return NextResponse.json({ ok }, { status: ok ? 200 : 502 });
}
