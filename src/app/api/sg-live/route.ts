import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { saveSgLiveFeed, sgRelayToken } from "../../../lib/sg-live-ingest";

export const dynamic = "force-dynamic";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function suppliedToken(req: NextRequest): string {
  const header = req.headers.get("authorization") || "";
  return /^Bearer\s+(.+)$/i.exec(header)?.[1] || req.headers.get("x-mkt88-secret") || "";
}

export async function POST(req: NextRequest) {
  const expected = await sgRelayToken();
  if (!expected) {
    return NextResponse.json({ error: "SG live receiver is not configured" }, { status: 503 });
  }
  const supplied = suppliedToken(req);
  if (!supplied || !timingSafeEqual(digest(expected), digest(supplied))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const text = await req.text();
  if (!text || text.length > 16_384) {
    return NextResponse.json({ error: "invalid payload" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const result = await saveSgLiveFeed(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(
    { ok: true, changed: result.changed, board: result.board },
    { headers: { "cache-control": "no-store" } }
  );
}
