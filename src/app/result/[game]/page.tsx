import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import LotteryCard, { type LotteryCardData } from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/LotteryCard";
import Footer from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";
import LiveResults from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/LiveResults";
import GoogleAdsense from "../../../components/GoogleAdsense";
import { gameBySlug } from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/GameDefs";
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
  const cards = def.cardIds.map((id) => byId.get(id)).filter((c): c is LotteryCardData => Boolean(c));
  return (
    <>
      <Header />
      <RegionButtons />
      <main className="container flex-shrink-0">
        <div className="row">
          <div className="col-12">
            <h1 style={{ fontSize: 20, margin: "10px 0 4px" }}>{def.name} Result {def.zh}</h1>
          </div>
        </div>
        <div className="row">
          {cards.map((c) => (
            <div key={c.id} className="col-12 col-sm-12 col-md-6 col-lg-4 mt-2 px-1">
              <LotteryCard card={c} />
            </div>
          ))}
        </div>
      </main>
      <Footer />
      <GoogleAdsense />
      <LiveResults />
    </>
  );
}
