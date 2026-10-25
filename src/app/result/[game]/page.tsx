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

/*
 * This page stays static on purpose.
 *
 * It was briefly revalidated every 30 seconds so its HTML would carry a live
 * board, but a stale entry made the client navigation wait for the whole
 * render - a three second spinner on every tap (reported 17 Oct 2026). The
 * page is served instantly again; anything the markup cannot vouch for is
 * masked until /api/home-live answers (see LiveResults), so an old board can
 * never be read as a result.
 */

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
  // A copy with numbers in it beats a fast render with none: the page waits for
  // one only when the instance has nothing cached, and a warm copy (which is the
  // normal case right after the home page has drawn) answers at once.
  const snap = await getSnapshot().catch(() => null);
  const snapProp = snap ? { cards: snap.cards, perdana: snap.perdana, hari: snap.hari, gd6: snap.gd6, gdjp7: snap.gdjp7, nine6: snap.nine6, nineJp: snap.nineJp } : undefined;
  const isKh = def.mode === "lotto";
  const pastDates = await getPastDateLists();
  const myDates = pastDates.my;
  const khDates = pastDates.kh;
  /*
   * Sports Toto runs three separate 6-number games beside the 4D draw, and each
   * now has its own page. They are listed together so a reader landing on the
   * 4D result can reach Star Toto and Supreme Toto as easily as Power Toto.
   */
  const relatedList = game === "sportstoto"
    ? [
        {
          id: "power-toto-link",
          title: "Power Toto 6/55 Result",
          text: "See the latest Power Toto winning numbers and jackpot, with draw time and past-result links.",
          href: "/result/power-toto",
          label: "Open Power Toto 6/55 result",
        },
        {
          id: "star-toto-link",
          title: "Star Toto 6/50 Result",
          text: "See the latest Star Toto winning numbers and jackpot, with draw time and past-result links.",
          href: "/result/star-toto",
          label: "Open Star Toto 6/50 result",
        },
        {
          id: "supreme-toto-link",
          title: "Supreme Toto 6/58 Result",
          text: "See the latest Supreme Toto winning numbers and jackpot, with draw time and past-result links.",
          href: "/result/supreme-toto",
          label: "Open Supreme Toto 6/58 result",
        },
      ]
    : game === "magnum"
      ? [
          {
            id: "magnum-jackpot-link",
            title: "Magnum 4D Jackpot Result",
            text: "See the latest Magnum Jackpot 1 and Jackpot 2 amounts, plus 4D Jackpot Gold.",
            href: "/result/magnum-4d-jackpot",
            label: "Open Magnum 4D Jackpot result",
          },
        ]
      : [];
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
      {relatedList.length ? (
        <section className="container py-3">
          <div className="row g-3">
            {relatedList.map((item) => (
              <div className="col-md-4" key={item.id}>
                <div className="border rounded p-3 h-100" aria-labelledby={item.id}>
                  <h2 id={item.id} className="h5 mb-1">{item.title}</h2>
                  <p className="mb-2">{item.text}</p>
                  <a href={item.href}>{item.label}</a>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <Footer />
      <GoogleAdsense />
      <LiveResults />
    </>
  );
}


