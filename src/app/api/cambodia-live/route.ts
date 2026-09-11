import { NextResponse } from "next/server";
import { getSnapshot } from "../../../lib/live-snapshot";

/** Perdana + Lucky HariHari + Cambodia 6D from the same pre-warmed snapshot. */
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSnapshot();
  const date = new Date(s.at).toISOString().slice(0, 10);
  return NextResponse.json(
    { date, perdana: s.perdana, hari: s.hari, gd6: s.gd6, gdjp7: s.gdjp7, nine6: s.nine6, nineJp: s.nineJp },
    { headers: { "cache-control": "no-store" } }
  );
}
