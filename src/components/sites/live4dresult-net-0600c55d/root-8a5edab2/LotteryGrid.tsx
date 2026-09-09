import LotteryCard, { type LotteryCardData } from "./LotteryCard";
import rawCards from "./cards-data.json";

const cardList = (rawCards as unknown as { cards: LotteryCardData[] }).cards;
const byId = new Map<string, LotteryCardData>(cardList.map((c) => [c.id, c]));

type ColItem = { type: "card"; id: string } | { type: "br" };

/**
 * Home "4D Result 马来西亚" order (each result its own card/column):
 * Magnum 4D -> Magnum Life -> Magnum Jackpot Gold -> Da Ma Cai 1+3D ->
 * Da Ma Cai 3+3D -> Sports Toto 4D -> Sports Toto 5D/6D -> Grand Dragon 4D ->
 * Grand Dragon 6D -> Nine Lotto 4D -> Nine Lotto 6D
 */
const ORDER = [
  "table-1-2026-09-06",   // Magnum 4D
  "table-3-2026-09-06",   // Magnum Life
  "table-2-2026-09-06",   // Magnum Jackpot Gold
  "table-4-2026-09-06",   // Da Ma Cai 1+3D
  "table-5-2026-09-06",   // Da Ma Cai 3+3D
  "table-6-2026-09-06",   // Sports Toto 4D
  "table-7-2026-09-06",   // Sports Toto 5D, 6D
  "table-13-2026-09-06",  // Grand Dragon 4D
  "table-14-2026-09-06-6d", // Grand Dragon 6D
  "table-17-2026-09-06",  // Nine Lotto 4D
  "table-18-2026-09-06-6d", // Nine Lotto 6D
];
const COLUMNS: ColItem[][] = ORDER.map((id) => [{ type: "card", id }]);

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


