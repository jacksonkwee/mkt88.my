import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import LotteryCard, { type LotteryCardData } from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/LotteryCard";
import Footer from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";
import LiveResults from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/LiveResults";
import GoogleAdsense from "../../../components/GoogleAdsense";
import { gameBySlug } from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/GameDefs";
import GamePager from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/GamePager";
import cardsRaw from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/cards-data.json";
import lottoRaw from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/lotto-data.json";

const allCards = [
  ...((cardsRaw as unknown as { cards: LotteryCardData[] }).cards || []),
  ...((lottoRaw as unknown as { cards: LotteryCardData[] }).cards || []),
];
const byId = new Map<string, LotteryCardData>(allCards.map((c) => [c.id, c]));

export async function generateMetadata({ params }: { params: Promise<{ game: string }> }): Promise<Metadata> {
  const { game } = await params;
  const def = gameBySlug[game];
  if (!def) return { title: "4D Result" };
  return { title: def.title, description: def.desc };
}

export async function generateStaticParams() {
  return Object.keys(gameBySlug).map((game) => ({ game }));
}

export default async function GamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const def = gameBySlug[game];
  if (!def) notFound();
  // Build columns: a "6D" card (id ends with -6d) is placed directly under
  // its matching base draw (e.g. Lucky HariHari 3:30PM 4D -> 3:30PM 6D below it).
  const cards: LotteryCardData[] = def.cardIds.map((id) => byId.get(id)).filter((c): c is LotteryCardData => Boolean(c));
  const cols: { key: string; items: LotteryCardData[] }[] = [];
  for (const c of cards) {
    if (/-6d$/.test(c.id)) {
      const base = c.id.replace(/-6d$/, "");
      const col = cols.find((x) => x.key === base);
      if (col) col.items.push(c);
      else cols.push({ key: c.id, items: [c] });
    } else {
      cols.push({ key: c.id, items: [c] });
    }
  }
  return (
    <>
      <Header />
      <RegionButtons />
      <div className="d-lg-none">
        <GamePager name={game} />
      </div>
      <div className="d-none d-lg-block">
        <main className="container flex-shrink-0">
          <div className="row">
            <div className="col-12">
              <h1 style={{ fontSize: 20, margin: "10px 0 4px" }}>{def.name} Result {def.zh}</h1>
            </div>
          </div>
          <div className="row">
            {cols.map((col) => (
              <div key={col.key} className="col-12 col-sm-12 col-md-6 col-lg-4 mt-2 px-1">
                {col.items.map((c, i) => (
                  <div key={c.id} className={i > 0 ? "mt-3" : ""}>
                    <LotteryCard card={c} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </main>
      </div>
      <Footer />
      <GoogleAdsense />
      <LiveResults />
    </>
  );
}
