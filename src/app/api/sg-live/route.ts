import { NextResponse } from "next/server";
import { firestoreGet, firestorePutIfUnchanged } from "../../../lib/fcm";

/*
 * Singapore 4D live board, pushed in by the VPS.
 *
 * live4d.sg publishes the current draw over plain HTTP only (its HTTPS host
 * fails the handshake and alpha2 times out), which the Vercel egress cannot
 * reach reliably - so the card used to wait for Singapore Pools' archive at
 * about 18:50. The VPS reads that feed every 30 seconds and posts here; this
 * route writes the same Firestore document the snapshot already reads as its
 * Singapore reference, so no merge logic has to change.
 */
export const dynamic = "force-dynamic";

/*
 * Fixed rather than read from the environment: Vercel already carries an
 * unrelated SG_PUSH_KEY value, and every push was being rejected with 401
 * (25 Oct 2026). The secret is only a guard against stray posts to a route that
 * writes six numbers; rotating it means editing this line and the VPS script.
 */
const KEY = "mkt-sg-7Q4t9pLm2XvR8sKd";
const DOC = "state/sg4d";

type Board = Record<string, string>;

function dayOf(board: Board): number {
  const match = /(\d{2})-(\d{2})-(\d{4})/.exec(board.date || "");
  return match ? Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : 0;
}

function hasLiveSignal(board: Board): boolean {
  const live = (value?: string) => /^\d{4}$/.test(String(value || "").trim());
  return ["first_prize", "second_prize", "third_prize"].some((key) => live(board[key])) ||
    Array.from({ length: 15 }, (_, i) => board["special-" + (i + 1)]).some(live);
}

async function storedBoard(): Promise<{ board: Board | null; updateTime: string | null }> {
  const doc = await firestoreGet<{ updateTime?: string; fields?: { json?: { stringValue?: string } } }>(DOC);
  const raw = doc?.fields?.json?.stringValue;
  if (!raw) return { board: null, updateTime: doc?.updateTime ?? null };
  try {
    const board = JSON.parse(raw) as Board;
    return { board: dayOf(board) ? board : null, updateTime: doc?.updateTime ?? null };
  } catch {
    return { board: null, updateTime: doc?.updateTime ?? null };
  }
}

export async function POST(req: Request) {
  if (req.headers.get("x-mkt-key") !== KEY) {
    return NextResponse.json({ ok: false, why: "forbidden" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.date) {
    return NextResponse.json({ ok: false, why: "bad body" }, { status: 400 });
  }

  // Only real values are copied - a blank in the feed must never erase a number
  // the board already shows.
  const incoming: Board = { date: String(body.date) };
  const take = (k: string) => {
    const v = body[k];
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (!s || /^-+$/.test(s)) return;
    incoming[k] = s;
  };
  take("draw_no");
  for (const key of ["first_prize", "second_prize", "third_prize"]) take(key);
  for (let i = 1; i <= 15; i++) take("special-" + i);
  for (let i = 1; i <= 10; i++) take("consolation-" + i);

  /*
   * live4d.sg opens a new draw with consolations only. That is not enough to
   * move the card away from the last complete draw: doing so produced a
   * 31/10 date above 28/10 numbers. Wait for a main prize or a special.
   */
  if (!dayOf(incoming) || !hasLiveSignal(incoming)) {
    return NextResponse.json(
      { ok: true, ignored: "waiting for main or special numbers" },
      { headers: { "cache-control": "no-store" } }
    );
  }

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const stored = await storedBoard();
      if (stored.board && dayOf(stored.board) > dayOf(incoming)) {
        return NextResponse.json(
          { ok: true, ignored: "a newer draw is already stored", date: stored.board.date },
          { headers: { "cache-control": "no-store" } }
        );
      }
      const board = stored.board && dayOf(stored.board) === dayOf(incoming)
        ? { ...stored.board, ...incoming }
        : incoming;
      const saved = await firestorePutIfUnchanged(
        DOC,
        { json: JSON.stringify(board) },
        stored.updateTime
      );
      if (saved) {
        return NextResponse.json(
          { ok: true, date: board.date, fields: Object.keys(board).length },
          { headers: { "cache-control": "no-store" } }
        );
      }
    }
    return NextResponse.json(
      { ok: false, why: "concurrent update, retry" },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, why: String(e) }, { status: 500 });
  }
}
