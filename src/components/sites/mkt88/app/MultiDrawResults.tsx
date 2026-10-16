"use client";

import LotteryCard, { type LotteryCardData } from "./LotteryCard";
import rawLotto from "./lotto-data.json";
import LiveResults from "./LiveResults";
import DirectTopAd from "./DirectTopAd";
import { perdanaIds, hariIds } from "./draw-order";
import { useDrawOrder } from "./use-draw-order";
import { overridesFor, useSnap } from "./use-live-snapshot";
import { splitSixCard } from "./six-split";

const cardList = (rawLotto as unknown as { cards: LotteryCardData[] }).cards;
const byId = new Map(cardList.map((c) => [c.id, c]));

function getCard(id: string): LotteryCardData | undefined {
  return byId.get(id);
}

export default function MultiDrawResults({ snap: serverSnap }: { snap?: unknown } = {}) {
  const night = useDrawOrder();
  const ctxSnap = useSnap();
  const snap = (serverSnap as ReturnType<typeof useSnap>) || ctxSnap;
  const per = perdanaIds();
  const hari = hariIds(night);

  const splitCards = (ids: string[]): LotteryCardData[] => {
    const out: LotteryCardData[] = [];
    for (const id of ids) {
      const card = getCard(id);
      if (!card) continue;
      const { result, jp, sixPlus } = splitSixCard(card);
      out.push(result);
      if (sixPlus) out.push(sixPlus);
      if (jp) out.push(jp);
    }
    return out;
  };

  /*
   * One game per row, in the same order as the Cambodia past-results page:
   * Grand Dragon, Nine Lotto, Perdana, Lucky HariHari. Each game's own cards
   * sit side by side within its row.
   *
   * The entries used to be individual triple-width Bootstrap columns, so a
   * game's extra cards (the 6D/JP boards) wrapped onto later rows and Lucky
   * HariHari's six cards were scattered across two rows - reported 12 Oct 2026.
   */
  const rows: LotteryCardData[][] = [
    splitCards(["table-13-2026-09-06", "table-14-2026-09-06-6d"]),
    splitCards(["table-17-2026-09-06", "table-18-2026-09-06-6d"]),
    splitCards(per),
    splitCards(hari),
  ].filter((row) => row.length > 0);

  return (
    <main className="container flex-shrink-0">
      <div className="row">
        <div className="col-sm-12">
          <DirectTopAd />
          <div id="row">
            {rows.map((row, ri) => (
              <div key={ri} className="row mx-0">
                {row.map((card) => (
                  <div key={card.id} className="col-12 col-md-6 col-lg-4 mt-3 px-1">
                    <LotteryCard card={card} {...overridesFor(snap, card.id, card.cardCls)} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <LiveResults />
    </main>
  );
}
