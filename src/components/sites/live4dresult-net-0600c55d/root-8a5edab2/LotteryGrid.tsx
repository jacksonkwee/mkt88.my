import LotteryCard, { type LotteryCardData } from "./LotteryCard";
import rawCards from "./cards-data.json";

const cardList = (rawCards as unknown as { cards: LotteryCardData[] }).cards;
const byId = new Map<string, LotteryCardData>(cardList.map((c) => [c.id, c]));

type ColItem = { type: "card"; id: string } | { type: "br" };

/** Desktop (web) keeps the original layout with grouped columns. */
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

/** App / phone view order: Magnum 4D, Magnum Life, Magnum JPGold, DaMaCai 1+3D,
 *  DaMaCai 3+3D, Sports Toto 4D, Sports Toto 5D/6D, Grand Dragon 4D/6D,
 *  Nine Lotto 4D/6D. */
const MOBILE_ORDER = [
  "table-1-2026-09-06",
  "table-3-2026-09-06",
  "table-2-2026-09-06",
  "table-4-2026-09-06",
  "table-5-2026-09-06",
  "table-6-2026-09-06",
  "table-7-2026-09-06",
  "table-13-2026-09-06",
  "table-14-2026-09-06-6d",
  "table-17-2026-09-06",
  "table-18-2026-09-06-6d",
];
const MOBILE: ColItem[][] = MOBILE_ORDER.map((id) => [{ type: "card", id }]);

function Grid({ cols, className }: { cols: ColItem[][]; className: string }) {
  return (
    <section className={"row " + className} data-live="">
      {cols.map((items, ci) => (
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

export default function LotteryGrid() {
  return (
    <div id="row">
      <Grid cols={MOBILE} className="d-lg-none" />
      <Grid cols={DESKTOP} className="d-none d-lg-flex" />
    </div>
  );
}
