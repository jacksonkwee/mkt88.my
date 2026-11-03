import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { saveSgLiveFeed, sgRelayToken } from "../../../lib/sg-live-ingest";

/*
 * Singapore 4D live board, pushed in by the VPS.
 *
 * live4d.sg publishes the current draw over plain HTTP only (its HTTPS host
 * fails the handshake and alpha2 times out), which the Vercel egress cannot
 * reach reliably - so the card used to wait for Singapore Pools' archive at
 * about 18:50. The VPS reads that feed every 30 seconds and posts it here.
 */
export const dynamic = "force-dynamic";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

async function authorized(req: Request): Promise<boolean> {
  const expected = await sgRelayToken();
  const header = req.headers.get("authorization") || "";
  const supplied =
    /^Bearer\s+(.+)$/i.exec(header)?.[1] ||
    req.headers.get("x-mkt-key") ||
    "";
  return !!expected && timingSafeEqual(digest(expected), digest(supplied));
}

export async function POST(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ ok: false, why: "forbidden" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, why: "bad body" }, { status: 400 });
  }

  const saved = await saveSgLiveFeed(body);
  if (!saved.ok) {
    return NextResponse.json(
      { ok: false, why: saved.error },
      { status: saved.status, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      date: saved.board.date,
      changed: saved.changed,
      fields: Object.keys(saved.board).length,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
