import { NextResponse } from "next/server";
import { firestorePut } from "../../../lib/fcm";

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
  const board: Record<string, string> = { date: String(body.date) };
  const take = (k: string) => {
    const v = body[k];
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (!s || /^-+$/.test(s)) return;
    board[k] = s;
  };
  take("draw_no");
  ["first_prize", "second_prize", "third_prize"].forEach(take);
  for (let i = 1; i <= 15; i++) take("special-" + i);
  for (let i = 1; i <= 10; i++) take("consolation-" + i);

  try {
    await firestorePut(DOC, { json: JSON.stringify(board) });
    return NextResponse.json({ ok: true, date: board.date, fields: Object.keys(board).length });
  } catch (e) {
    return NextResponse.json({ ok: false, why: String(e) }, { status: 500 });
  }
}
