import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";
import { getSourceHealth } from "../../../lib/source-health";

export const dynamic = "force-dynamic";

/**
 * Which live sources are behaving today.
 *
 * `?summary=1` is the public half - just the names that need attention, no
 * reasons and nothing internal - so the evening health check and any monitoring
 * probe can watch it. The full list, with the reason and when each source was
 * last good, is for the admin panel.
 */
export async function GET(req: Request) {
  const sources = await getSourceHealth();
  const bad = sources.filter((s) => !s.ok);
  if (new URL(req.url).searchParams.get("summary") === "1") {
    return NextResponse.json(
      // The reason is included: it is about our own plumbing, and knowing WHICH
      // shape changed is what turns "something is wrong" into a ten-minute fix.
      { at: Date.now(), bad: bad.map((s) => ({ source: s.name, why: s.why || "shape changed" })) },
      { headers: { "cache-control": "public, s-maxage=30" } }
    );
  }
  const store = await cookies();
  if (!verifyToken(store.get(COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  return NextResponse.json({ at: Date.now(), bad: bad.length, sources });
}
