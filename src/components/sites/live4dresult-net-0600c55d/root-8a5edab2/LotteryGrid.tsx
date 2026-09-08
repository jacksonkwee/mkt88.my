import LotteryCard, { type LotteryCardData } from "./LotteryCard";
import rawCards from "./cards-data.json";

const cardList = (rawCards as unknown as { cards: LotteryCardData[] }).cards;
const byId = new Map<string, LotteryCardData>(cardList.map((c) => [c.id, c]));

type ColItem = { type: "card"; id: string } | { type: "br" };

/**
 * Column arrangement mirrors the live page markup exactly:
 *  - row 1: Magnum, SportsToto 4D, DaMaCai 1+3D
 *  - row 2: Magnum Life + <br> + Magnum Jackpot Gold (same column),
 *           SportsToto 5D/6D/Lotto, Da Ma Cai 3+3D
 *  - row 3: Grand Dragon 4D, Nine Lotto
 * (Dynamic ad wrappers the original injects between cards are not reproduced;
 * they collapse to zero height on ad-blocked renders.)
 */
const COLUMNS: ColItem[][] = [
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
  [{ type: "card", id: "table-13-2026-09-06" }],
  [{ type: "card", id: "table-17-2026-09-06" }],
];

export default function LotteryGrid() {
  return (
    <div id="row">
      <section className="row" data-live="">
        {COLUMNS.map((items, ci) => (
          <div
            key={ci}
            className="col-12 col-sm-12 col-md-6 col-lg-4 mt-3 px-1"
          >
            {items.map((item, ii) => {
              if (item.type === "br") return <br key={ii} />;
              const card = byId.get(item.id);
              return card ? <LotteryCard key={card.id} card={card} /> : null;
            })}
          </div>
        ))}
      </section>
    </div>
  );
}


