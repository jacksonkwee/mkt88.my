"use client";

import LotteryCard, { type LotteryCardData } from "./LotteryCard";
import rawLotto from "./lotto-data.json";
import LiveResults from "./LiveResults";
import DirectTopAd from "./DirectTopAd";
import { perdanaIds, hariIds } from "./draw-order";
import { useDrawOrder } from "./use-draw-order";
import { overridesFor, useSnap } from "./use-live-snapshot";

const cardList = (rawLotto as unknown as { cards: LotteryCardData[] }).cards;
const byId = new Map<string, LotteryCardData>(cardList.map((c) => [c.id, c]));

/**
 * Cambodia / Lotto 4D results grid. Perdana 4D and Lucky HariHari each run TWO
 * draws a day - the draw we are waiting for is shown first, and every HariHari
 * 6D result sits directly below its own 4D result.
 * Used by both /lotto-4d and /cambodia-4d-results so the region results and
 * the Lotto 4D results are identical.
 */
const LEADING: string[][] = [
  ["table-13-2026-09-06", "table-14-2026-09-06-6d"],
  ["table-17-2026-09-06", "table-18-2026-09-06-6d"],
];

export default function MultiDrawResults({ snap: serverSnap }: { snap?: unknown } = {}) {
  const night = useDrawOrder();
  const ctxSnap = useSnap();
  const snap = (serverSnap as ReturnType<typeof useSnap>) || ctxSnap;
  const per = perdanaIds(night);
  const hari = hariIds(night);
  const columns: string[][] = [
    ...LEADING,
    [per[0]],
    [per[1]],
    [hari[0], hari[1]],
    [hari[2], hari[3]],
  ];

  return (
    <main className="container flex-shrink-0">
      <div className="row">
        <div className="col-sm-12">
          <DirectTopAd />
          <div id="row">
            <div className="row">
              {columns.map((ids, ci) => (
                <div key={ci} className="col-12 col-sm-12 col-md-6 col-lg-4 mt-3 px-1">
                  {ids.map((id, ii) => {
                    const card = byId.get(id);
                    return card ? (
                      <div key={id} className={ii > 0 ? "mt-3" : ""}>
                        <LotteryCard card={card} {...overridesFor(snap, card.id, card.cardCls)} />
                      </div>
                    ) : null;
                  })}
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


