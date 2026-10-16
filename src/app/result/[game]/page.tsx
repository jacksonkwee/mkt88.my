import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "../../../components/sites/mkt88/app/Header";
import RegionButtons from "../../../components/sites/mkt88/app/RegionButtons";
import Footer from "../../../components/sites/mkt88/app/Footer";
import LiveResults from "../../../components/sites/mkt88/app/LiveResults";
import GoogleAdsense from "../../../components/GoogleAdsense";
import { gameBySlug } from "../../../components/sites/mkt88/app/GameDefs";
import GamePager from "../../../components/sites/mkt88/app/GamePager";
import GameColumns from "../../../components/sites/mkt88/app/GameColumns";
import { getSnapshot } from "../../../lib/live-snapshot";
import GamePastFilter from "../../../components/sites/mkt88/app/GamePastFilter";
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
      {/* The card never carried a heading of its own, so the page had none at
          all; this names it for Google and for a screen reader without
          drawing anything (see .sr-only). */}
      <h1 className="sr-only">{def.title}</h1>
      <RegionButtons />
      <div className="d-lg-none">
        <GamePager name={game} snap={snapProp} pastDates={pastDates} showPast />
      </div>
      <div className="d-none d-lg-block mkt-past-scope">
        <main className="container flex-shrink-0">
          <div className="row">
            <div className="col-12">
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


