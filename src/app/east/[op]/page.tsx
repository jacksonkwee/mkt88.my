import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "../../../components/sites/mkt88/app/Header";
import RegionButtons from "../../../components/sites/mkt88/app/RegionButtons";
import Footer from "../../../components/sites/mkt88/app/Footer";
import GamePager from "../../../components/sites/mkt88/app/GamePager";
import GameColumns from "../../../components/sites/mkt88/app/GameColumns";
import GamePastFilter from "../../../components/sites/mkt88/app/GamePastFilter";
import { EAST_CARD_IDS } from "../../../components/sites/mkt88/app/east-cards";
import { getSnapshotForRender } from "../../../lib/live-snapshot";
import { getPastDateLists } from "../../../lib/past-dates";

const OPS: Record<string, { title: string; desc: string; pager: string; name: string }> = {
  stc: { title: "Sandakan 4D 山打根赛马会 Result", desc: "Sandakan 4D live results.", pager: "sandakan", name: "Sandakan 4D 山打根赛马会" },
  sabah88: { title: "Sabah 88 4D 沙巴万字 Result", desc: "Sabah 88 4D live results.", pager: "sabah88", name: "Sabah 88 4D 沙巴万字" },
  cashsweep: { title: "Special Cash Sweep 4D 砂拉越大万 Result", desc: "Special Cash Sweep 4D live results.", pager: "cashsweep", name: "Special Cash Sweep 4D 砂拉越大万" },
};

export async function generateStaticParams() {
  return Object.keys(OPS).map((op) => ({ op }));
}

export async function generateMetadata({ params }: { params: Promise<{ op: string }> }): Promise<Metadata> {
  const { op } = await params;
  const o = OPS[op];
  if (!o) return { title: "4D Result" };
  return { title: o.title, description: o.desc, alternates: { canonical: "/east/" + op } };
}

/**
 * One east game (Sabah 88, Cash Sweep, Sandakan).
 *
 * This page used to hand its card to SnapshotPage as the raw captured HTML,
 * which gave it a different size and position from every other game - and on a
 * desktop the ad-stripper removed it altogether, so the page showed no result at
 * all (reported 11 Oct 2026). It now renders through the same GameColumns /
 * GamePager pair as /result/[game], so the card is identical by construction.
 */
export default async function EastPage({ params }: { params: Promise<{ op: string }> }) {
  const { op } = await params;
  const o = OPS[op];
  if (!o) notFound();
  const snap = await getSnapshotForRender().catch(() => null);
  const snapProp = snap
    ? { cards: snap.cards, perdana: snap.perdana, hari: snap.hari, gd6: snap.gd6, gdjp7: snap.gdjp7, nine6: snap.nine6, nineJp: snap.nineJp }
    : undefined;
  const pastDates = await getPastDateLists();
  return (
    <>
      <Header />
      {/* Same as /result/[game]: no visible page title, so the name lives here
          for Google and for a screen reader (see .sr-only). */}
      <h1 className="sr-only">{o.title}</h1>
      <RegionButtons />
      <div className="d-lg-none">
        <GamePager name={o.pager} snap={snapProp} pastDates={pastDates} showPast />
      </div>
      <div className="d-none d-lg-block mkt-past-scope">
        <main className="container flex-shrink-0">
          <div className="row">
            <div className="col-12">
              <GamePastFilter slug={o.pager} name={o.name} kind="my" dates={pastDates.my} tables={pastDates.myTables} />
            </div>
          </div>
          <GameColumns ids={EAST_CARD_IDS[o.pager]} snap={snapProp} wide />
        </main>
      </div>
      <Footer />
    </>
  );
}
