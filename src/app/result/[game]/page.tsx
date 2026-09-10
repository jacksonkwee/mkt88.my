import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import Footer from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";
import LiveResults from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/LiveResults";
import GoogleAdsense from "../../../components/GoogleAdsense";
import { gameBySlug } from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/GameDefs";
import GamePager from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/GamePager";
import GameColumns from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/GameColumns";

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
          <GameColumns ids={def.cardIds} />
        </main>
      </div>
      <Footer />
      <GoogleAdsense />
      <LiveResults />
    </>
  );
}
