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
import { getSnapshot } from "../../../lib/live-snapshot";
import GamePastFilter from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/GamePastFilter";
import { getPastDateLists } from "../../../lib/past-dates";

export async function generateMetadata({ params }: { params: Promise<{ game: string }> }): Promise<Metadata> {
  const { game } = await params;
  const def = gameBySlug[game];
  if (!def) return { title: "4D Result" };
  return { title: def.title, description: def.desc, alternates: { canonical: "/result/" + game } };
}

export async function generateStaticParams() {
  return Object.keys(gameBySlug).map((game) => ({ game }));
}

export default async function GamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const def = gameBySlug[game];
  if (!def) notFound();
  const snap = await getSnapshot().catch(() => null);
  const snapProp = snap ? { cards: snap.cards, perdana: snap.perdana, hari: snap.hari, gd6: snap.gd6, gdjp7: snap.gdjp7, nine6: snap.nine6, nineJp: snap.nineJp } : undefined;
  const isKh = def.mode === "lotto";
  const pastDates = await getPastDateLists();
  const myDates = pastDates.my;
  const khDates = pastDates.kh;
  return (
    <>
      <Header />
      <RegionButtons />
      <div className="d-lg-none">
        <GamePager name={game} snap={snapProp} pastDates={pastDates} showPast />
      </div>
      <div className="d-none d-lg-block mkt-past-scope">
        <main className="container flex-shrink-0">
          <div className="row">
            <div className="col-12">
              <h1 style={{ fontSize: 20, margin: "10px 0 4px" }}>{def.name} Result {def.zh}</h1>
              <GamePastFilter slug={game} name={def.name} kind={isKh ? "kh" : "my"} dates={isKh ? (pastDates.khByGame?.[game] || khDates) : myDates} tables={isKh ? undefined : pastDates.myTables} />
            </div>
          </div>
          <GameColumns ids={def.cardIds} snap={snapProp} />
        </main>
      </div>
      <Footer />
      <GoogleAdsense />
      <LiveResults />
    </>
  );
}


