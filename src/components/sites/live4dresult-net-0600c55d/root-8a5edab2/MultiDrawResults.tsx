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
  const per = perdanaIds(night);
  const hari = hariIds(night);

  const splitColumn = (ids: string[]): LotteryCardData[][] => {
    const out: LotteryCardData[][] = [];
    for (const id of ids) {
      const card = getCard(id);
      if (!card) continue;
      const { result, jp } = splitSixCard(card);
      out.push([result]);
      if (jp) out.push([jp]);
    }
    return out;
  };

  const columns: LotteryCardData[][] = [
    ...splitColumn(["table-13-2026-09-06", "table-14-2026-09-06-6d"]),
    ...splitColumn(["table-17-2026-09-06", "table-18-2026-09-06-6d"]),
    ...splitColumn([per[0]]),
    ...splitColumn([per[1]]),
    ...splitColumn([hari[0], hari[1]]),
    ...splitColumn([hari[2], hari[3]]),
  ].filter((col) => col.length > 0);

  return (
    <main className="container flex-shrink-0">
      <div className="row">
        <div className="col-sm-12">
          <DirectTopAd />
          <div id="row">
            <div className="row">
              {columns.map((items, ci) => (
                <div key={ci} className="col-12 col-sm-12 col-md-6 col-lg-4 mt-3 px-1">
                  {items.map((card, ii) => (
                    <div key={card.id} className={ii > 0 ? "mt-3" : ""}>
                      <LotteryCard card={card} {...overridesFor(snap, card.id, card.cardCls)} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <LiveResults />
    </main>
  );
}
