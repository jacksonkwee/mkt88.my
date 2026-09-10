import { NextResponse } from "next/server";
import { getSnapshot } from "../../../lib/live-snapshot";

/** Pre-warmed snapshot of every result card (+ the two-draw games). */
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSnapshot();
  return NextResponse.json(
    { at: s.at, cards: s.cards, perdana: s.perdana, hari: s.hari },
    { headers: { "cache-control": "no-store" } }
  );
}
