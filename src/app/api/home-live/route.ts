import { NextResponse } from "next/server";
import { getSnapshot } from "../../../lib/live-snapshot";

/** Pre-warmed snapshot of every result card (+ the two-draw games). */
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSnapshot({ wait: true });
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
