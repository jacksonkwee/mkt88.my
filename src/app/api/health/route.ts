import { NextResponse } from "next/server";
import { getSnapshotForRender } from "../../../lib/live-snapshot";

export const dynamic = "force-dynamic";

/** Fast process health check: never waits for a stalled snapshot rebuild. */
export async function GET() {
  const snapshot = await getSnapshotForRender();
  const ageMs = snapshot.at ? Date.now() - snapshot.at : Number.MAX_SAFE_INTEGER;
  const ok = ageMs <= 30_000;
  return NextResponse.json(
    { ok, snapshotAt: snapshot.at || null, snapshotAgeMs: snapshot.at ? ageMs : null },
    {
      status: ok ? 200 : 503,
      headers: { "cache-control": "no-store" },
    }
  );
}
