import LotteryCard, { type LotteryCardData } from "./LotteryCard";
import rawLotto from "./lotto-data.json";
import LiveResults from "./LiveResults";
import DirectTopAd from "./DirectTopAd";

const cardList = (rawLotto as unknown as { cards: LotteryCardData[] }).cards;
const byId = new Map<string, LotteryCardData>(cardList.map((c) => [c.id, c]));

type ColItem = { type: "card"; id: string } | { type: "br" };

/**
 * Cambodia / Lotto 4D results grid. Perdana 4D and Lucky HariHari each run
 * TWO draws a day (official: perdana4d.com and hari4d.com) - both draws are
 * shown, one per column, so each game's two draws sit side by side.
 * Used by both /lotto-4d and /cambodia-4d-results so the region results and
 * the Lotto 4D results are identical.
 */
const COLUMNS: ColItem[][] = [
  [{ type: "card", id: "table-13-2026-09-06" }],
  [{ type: "card", id: "table-16-2026-09-06-1530" }],
  [{ type: "card", id: "table-16-2026-09-06-1930" }],
  [{ type: "card", id: "table-17-2026-09-06" }],
  [{ type: "card", id: "table-15-2026-09-06-1530" }],
  [{ type: "card", id: "table-15-2026-09-06-1930" }],
];

export default function MultiDrawResults() {
  return (
    <main className="container flex-shrink-0">
      <div className="row">
        <div className="col-sm-12">
          <DirectTopAd />
          <div id="row">
            <div className="row">
              {COLUMNS.map((items, ci) => (
                <div key={ci} className="col-12 col-sm-12 col-md-6 col-lg-4 mt-3 px-1">
                  {items.map((item, ii) => {
                    if (item.type === "br") return <br key={ii} />;
                    const card = byId.get(item.id);
                    return card ? <LotteryCard key={card.id} card={card} /> : null;
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

