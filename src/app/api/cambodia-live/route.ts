import { NextResponse } from "next/server";
import { getSnapshot } from "../../../lib/live-snapshot";

/** Perdana + Lucky HariHari from the same pre-warmed snapshot. */
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSnapshot();
  const date = new Date(s.at).toISOString().slice(0, 10);
  return NextResponse.json({ date, perdana: s.perdana, hari: s.hari }, { headers: { "cache-control": "no-store" } });
}
