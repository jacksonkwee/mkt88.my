import { NextResponse, after } from "next/server";
import { getSnapshot } from "../../../lib/live-snapshot";
import { pushConfigured } from "../../../lib/fcm";
import { checkAndPush } from "../../../lib/push-notify";

/** Pre-warmed snapshot of every result card (+ the two-draw games). */
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSnapshot({ wait: true });
  /*
   * Every open app polls this, so it is the natural place to notice that a draw
   * has just finished and wake the phones that are closed. after() runs it once
   * the response is on its way, so nobody waits for it, and it does nothing at
   * all until FIREBASE_SERVICE_ACCOUNT is set.
   */
  if (pushConfigured()) after(() => checkAndPush());
  return NextResponse.json(
    { at: s.at, cards: s.cards, perdana: s.perdana, hari: s.hari },
    { headers: {
      // Served from Vercel's shared cache for a few seconds so every phone gets
      // the SAME snapshot.
      //
      // The snapshot itself is kept in memory per serverless instance, and
      // Vercel runs several - measured, one was handing out a copy 29 seconds
      // old while another was rebuilding every 2.5 seconds. That is what made a
      // live number arrive up to half a minute after the other app had it.
      // Edge caching makes the freshness the same for everybody.
      "cache-control": "public, s-maxage=1, stale-while-revalidate=1",
    } }
  );
}
