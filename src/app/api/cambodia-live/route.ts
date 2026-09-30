import { NextResponse } from "next/server";
import { getSnapshot } from "../../../lib/live-snapshot";

/** Perdana + Lucky HariHari + Cambodia 6D from the same pre-warmed snapshot. */
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSnapshot();
  const date = new Date(s.at).toISOString().slice(0, 10);
  return NextResponse.json(
    { date, perdana: s.perdana, hari: s.hari, gd6: s.gd6, gdjp7: s.gdjp7, nine6: s.nine6, nineJp: s.nineJp },
    { headers: {
      // Served from Vercel's shared cache for a few seconds so every phone gets
      // the SAME snapshot.
      //
      // The snapshot itself is kept in memory per serverless instance, and
      // Vercel runs several - measured, one was handing out a copy 29 seconds
      // old while another was rebuilding every 2.5 seconds. That is what made a
      // live number arrive up to half a minute after the other app had it.
      // Edge caching makes the freshness the same for everybody.
      "cache-control": "public, s-maxage=3, stale-while-revalidate=6",
    } }
  );
}
