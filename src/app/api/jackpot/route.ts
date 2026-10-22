import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { jackpotCardFields, normalizeJackpotFeed } from "../../../lib/jackpot-feed";
import { saveJackpotFeed } from "../../../lib/jackpot-store";

export const dynamic = "force-dynamic";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function authorized(req: NextRequest): boolean {
  const expected = process.env.JACKPOT_INGEST_SECRET || process.env.ADMIN_SECRET || "";
  const header = req.headers.get("authorization") || "";
  const supplied = /^Bearer\s+(.+)$/i.exec(header)?.[1] || req.headers.get("x-mkt88-secret") || "";
  return !!expected && timingSafeEqual(digest(expected), digest(supplied));
}

export async function POST(req: NextRequest) {
  if (!process.env.JACKPOT_INGEST_SECRET && !process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "jackpot receiver is not configured" }, { status: 503 });
  }
  if (!authorized(req)) {
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
  if (!normalizeJackpotFeed(body)) {
    return NextResponse.json({ error: "Magnum and Da Ma Cai jackpot values are required" }, { status: 400 });
  }

  const saved = await saveJackpotFeed(body);
  if (!saved) {
    return NextResponse.json({ error: "Firestore save failed" }, { status: 503 });
  }
  return NextResponse.json(
    { ok: true, receivedAt: saved.receivedAt, cards: jackpotCardFields(saved) },
    { headers: { "cache-control": "no-store" } }
  );
}
