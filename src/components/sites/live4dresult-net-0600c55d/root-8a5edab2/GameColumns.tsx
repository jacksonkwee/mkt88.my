"use client";

import LotteryCard, { type LotteryCardData } from "./LotteryCard";
import cardsRaw from "./cards-data.json";
import lottoRaw from "./lotto-data.json";
import { useDrawOrder } from "./use-draw-order";
import { overridesFor, useSnap } from "./use-live-snapshot";
import { splitSixCard } from "./six-split";

const allCards = [
  ...((cardsRaw as unknown as { cards: LotteryCardData[] }).cards || []),
  ...((lottoRaw as unknown as { cards: LotteryCardData[] }).cards || []),
];
const byId = new Map<string, LotteryCardData>(allCards.map((c) => [c.id, c]));

function slotOf(key: string): number {
  if (key.includes("-1930")) return 2;
  if (key.includes("-1530")) return 1;
  return 0;
}

/**
 * Desktop result columns for one game.
 * A 6D card always sits directly under its own 4D card, and the two-draw
 * games (Perdana / Lucky HariHari) put the draw we are waiting for on the left.
 */
export default function GameColumns({ ids, snap: serverSnap }: { ids: string[]; snap?: unknown }) {
  const night = useDrawOrder();
  const ctxSnap = useSnap();
  const snap = (serverSnap as ReturnType<typeof useSnap>) || ctxSnap;

  const cols: { key: string; items: LotteryCardData[] }[] = [];
  for (const id of ids) {
    const stored = byId.get(id);
    if (!stored) continue;
    const { result, jp } = splitSixCard(stored);
    const base = id.replace(/-6d$/, "");
    if (/-6d$/.test(id)) {
      const col = cols.find((x) => x.key === base);
      if (col) col.items.push(result);
      else cols.push({ key: base, items: [result] });
    } else {
      cols.push({ key: base, items: [result] });
    }
    if (jp) cols.push({ key: id + "-jp", items: [jp] });
  }

  // When a game has both draw times, the active one goes first.
  const hasBoth = cols.some((c) => slotOf(c.key) === 1) && cols.some((c) => slotOf(c.key) === 2);
  if (hasBoth) {
    cols.sort((a, b) => (night ? slotOf(b.key) - slotOf(a.key) : slotOf(a.key) - slotOf(b.key)));
  }

  return (
    <div className="row">
      {cols.map((col) => (
        <div key={col.key} className="col-12 col-sm-12 col-md-6 col-lg-4 mt-2 px-1">
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



