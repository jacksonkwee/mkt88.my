import LotteryCard, { type LotteryCardData } from "./LotteryCard";
import GamePager from "./GamePager";
import GamePastFilter from "./GamePastFilter";
import cardsRaw from "./cards-data.json";
import { overridesFor, type Snap } from "./snapshot-values";

const cardList = (cardsRaw as unknown as { cards: LotteryCardData[] }).cards;
const byId = new Map<string, LotteryCardData>(cardList.map((c) => [c.id, c]));

type ColItem = { type: "card"; id: string } | { type: "br" };

const DESKTOP: ColItem[][] = [
  [{ type: "card", id: "table-1-2026-09-06" }],
  [{ type: "card", id: "table-4-2026-09-06" }],
  [{ type: "card", id: "table-6-2026-09-06" }],
  [
    { type: "card", id: "table-3-2026-09-06" },
    { type: "br" },
    { type: "card", id: "table-2-2026-09-06" },
  ],
  [{ type: "card", id: "table-5-2026-09-06" }],
  [{ type: "card", id: "table-7-2026-09-06" }],
  [
    { type: "card", id: "table-13-2026-09-06" },
    { type: "br" },
    { type: "card", id: "table-14-2026-09-06-6d" },
  ],
  [
    { type: "card", id: "table-17-2026-09-06" },
    { type: "br" },
    { type: "card", id: "table-18-2026-09-06-6d" },
  ],
];

/**
 * The desktop home grid.
 *
 * It has to be given the live snapshot, exactly like the phone pager is. Without
 * it the cards fell back to the numbers baked into them on 06-09-2026, and
 * because LotteryCard only knows a card has moved on when the snapshot's date
 * differs from the card's own, those month-old numbers were printed under
 * today's date - the "date is today, numbers are yesterday's" report of
 * 11 Oct 2026. With the snapshot here the stale cells are blanked instead.
 */
function DesktopGrid({ snap }: { snap?: Snap }) {
  return (
    <section className="row d-none d-lg-flex" data-live="">
      {DESKTOP.map((items, ci) => (
        <div key={ci} className="col-12 col-sm-12 col-md-6 col-lg-4 mt-3 px-1">
          {items.map((item, ii) => {
            if (item.type === "br") return <br key={ii} />;
            const card = byId.get(item.id);
            return card ? <LotteryCard key={card.id} card={card} {...overridesFor(snap || {}, card.id, card.cardCls)} /> : null;
          })}
        </div>
      ))}
    </section>
  );
}

export default function LotteryGrid({ snap, pastDates, myDates }: {
  snap?: unknown;
  pastDates?: { my: string[]; kh: string[]; myTables?: Record<string, string[]> };
  myDates?: string[];
}) {
  return (
    <div id="row">
      <div className="d-lg-none">
        <GamePager initialIndex={0} snap={snap} pastDates={pastDates} showPast />
      </div>
      <div className="mkt-past-scope">
        {pastDates && myDates ? (
          <div className="d-none d-lg-block">
            <GamePastFilter
              slug="home"
              name="4D Result 马来西亚"
              kind="my"
              dates={myDates}
              tables={pastDates.myTables}
            />
          </div>
        ) : null}
        <DesktopGrid snap={snap as Snap | undefined} />
      </div>
    </div>
  );
}

