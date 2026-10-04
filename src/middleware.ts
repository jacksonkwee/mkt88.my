import { NextResponse, type NextRequest } from "next/server";

/**
 * Keep the page HTML at the edge for a few seconds.
 *
 * Every page is rendered by a serverless function that falls asleep when nobody
 * is around, and the first visitor then waited 4-6 seconds while it started up
 * (measured 4 Oct 2026). Vercel only caches a response when it is told it may,
 * and Next marks these pages "no-cache" because the numbers change - so the
 * permission is given here instead, for the page HTML only.
 *
 * Nothing user-specific is rendered into the page any more: whether someone is
 * in the installed app is decided in the page itself, from the same cached
 * bytes. The numbers stay live because the page replaces them from
 * /api/home-live on its first tick, and that endpoint is left strictly alone.
 */
export function middleware(_req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=60");
  return res;
}

export const config = {
  // Pages only: the API and anything with a file extension is untouched.
  matcher: ["/((?!api/|admin|_next/|.*\\..*).*)"],
};
