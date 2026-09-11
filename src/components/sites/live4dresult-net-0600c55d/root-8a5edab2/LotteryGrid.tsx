import LotteryCard, { type LotteryCardData } from "./LotteryCard";
import GamePager from "./GamePager";
import GamePastFilter from "./GamePastFilter";
import cardsRaw from "./cards-data.json";

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

function DesktopGrid() {
  return (
    <section className="row d-none d-lg-flex" data-live="">
      {DESKTOP.map((items, ci) => (
        <div key={ci} className="col-12 col-sm-12 col-md-6 col-lg-4 mt-3 px-1">
          {items.map((item, ii) => {
            if (item.type === "br") return <br key={ii} />;
            const card = byId.get(item.id);
            return card ? <LotteryCard key={card.id} card={card} /> : null;
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
      <DesktopGrid />
    </div>
  );
}

