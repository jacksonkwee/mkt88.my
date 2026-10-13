"use client";

import LotteryCard, { type LotteryCardData } from "./LotteryCard";
import cardsRaw from "./cards-data.json";
import lottoRaw from "./lotto-data.json";
import { EAST_CARDS } from "./east-cards";
import { useDrawOrder } from "./use-draw-order";
import { overridesFor, useSnap } from "./use-live-snapshot";
import { splitSixCard } from "./six-split";

const allCards = [
  ...((cardsRaw as unknown as { cards: LotteryCardData[] }).cards || []),
  ...((lottoRaw as unknown as { cards: LotteryCardData[] }).cards || []),
  ...EAST_CARDS,
];
const byId = new Map<string, LotteryCardData>(allCards.map((c) => [c.id, c]));

function slotOf(key: string): number {
  if (key.includes("-1930")) return 2;
  if (key.includes("-1530")) return 1;
  return 0;
}

/**
 * The three east games take a wider column.
 *
 * Sabah 88, Cash Sweep and Sandakan carry the operator's extra boards, and in
 * the narrow third-of-a-page column their numbers came out cramped. They take
 * two thirds of the page instead (11 Oct 2026), on their own pages and on the
 * East 4D page that lists all three - both render the same card, so both are
 * the same size, and the number columns get the room they need.
 */
const EAST_GAME = /^table-(8|9|10)\b/;

/**
 * Desktop result columns for one game.
 * A 6D card always sits directly under its own 4D card, and the two-draw
 * games (Perdana / Lucky HariHari) put the draw we are waiting for on the left.
 */
export default function GameColumns({ ids, snap: serverSnap, wide }: { ids: string[]; snap?: unknown; wide?: boolean }) {
  const night = useDrawOrder();
  const ctxSnap = useSnap();
  const snap = (serverSnap as ReturnType<typeof useSnap>) || ctxSnap;

  const cols: { key: string; items: LotteryCardData[] }[] = [];
  for (const id of ids) {
    const stored = byId.get(id);
    if (!stored) continue;
    const { result, jp, sixPlus } = splitSixCard(stored);
    const base = id.replace(/-6d$/, "");
    // The draw's jackpot card belongs in the same column as the draw itself.
    // Giving it a column of its own put Perdana / Lucky HariHari into four
    // columns for two draw times, so the 7:30PM jackpot wrapped onto a row of
    // its own instead of sitting beside the 3:30PM draw.
    let col = cols.find((x) => x.key === base);
    if (!col) {
      col = { key: base, items: [] };
      cols.push(col);
    }
    col.items.push(result);
    // Nine Lotto 6+1D sits directly under the 6D result, above the 6D JP card.
    if (sixPlus) col.items.push(sixPlus);
    if (jp) col.items.push(jp);
  }

  // When a game has both draw times, the active one goes first.
  const hasBoth = cols.some((c) => slotOf(c.key) === 1) && cols.some((c) => slotOf(c.key) === 2);
  if (hasBoth) {
    cols.sort((a, b) => (night ? slotOf(b.key) - slotOf(a.key) : slotOf(a.key) - slotOf(b.key)));
  }

  return (
    <div className="row">
      {cols.map((col) => (
        <div key={col.key} className={"col-12 col-sm-12 col-md-6 mt-2 px-1 " + (wide && EAST_GAME.test(col.key) ? "col-lg-8 mkt-east-col" : "col-lg-4")}>
          {col.items.map((c, i) => (
            <div key={c.id} className={i > 0 ? "mt-3" : ""}>
              <LotteryCard card={c} {...overridesFor(snap, c.id, c.cardCls)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}



