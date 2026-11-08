import { NextResponse } from "next/server";
import { getHeadlineLive, refreshHeadlineLive } from "../../../lib/live-snapshot";

export const dynamic = "force-dynamic";

/**
 * Small, non-blocking live lane for Sports Toto and Singapore 4D.
 *
 * The full snapshot waits for every operator. These two feeds finish their
 * first prizes while the main sweep can still be busy elsewhere, so phones poll
 * this tiny response separately during a draw.
 */
export async function GET() {
  refreshHeadlineLive();
  return NextResponse.json(getHeadlineLive(), {
    headers: { "cache-control": "no-store" },
  });
}
