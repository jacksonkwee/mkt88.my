import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";
import { getSourceHealth } from "../../../lib/source-health";
import gdNinePastRaw from "../../../lib/gd-nine-past.json";
import { coreResultComplete, pastRecordStatus } from "../../../lib/past-completeness.mjs";

export const dynamic = "force-dynamic";

function pastArchiveHealth() {
  const store = gdNinePastRaw as unknown as Record<string, Record<string, string>>;
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const incomplete: { date: string; status: Record<string, string> }[] = [];
  let complete = 0;
  for (let i = 1; i <= 30; i++) {
    const date = day.format(new Date(Date.now() - i * 86400000));
    const record = store[date];
    if (record && coreResultComplete(record, "gd") && coreResultComplete(record, "nine")) complete++;
    else incomplete.push({ date, status: record ? pastRecordStatus(record) : {} });
  }
  return { windowDays: 30, complete, incomplete };
}

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
  const past = pastArchiveHealth();
  if (new URL(req.url).searchParams.get("summary") === "1") {
    return NextResponse.json(
      // The reason is included: it is about our own plumbing, and knowing WHICH
      // shape changed is what turns "something is wrong" into a ten-minute fix.
      {
        at: Date.now(),
        bad: bad.map((s) => ({ source: s.name, why: s.why || "shape changed" })),
        past: {
          windowDays: past.windowDays,
          complete: past.complete,
          incomplete: past.incomplete.map((x) => x.date),
        },
      },
      { headers: { "cache-control": "public, s-maxage=30" } }
    );
  }
  const store = await cookies();
  if (!verifyToken(store.get(COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  return NextResponse.json({ at: Date.now(), bad: bad.length, sources, past });
}
