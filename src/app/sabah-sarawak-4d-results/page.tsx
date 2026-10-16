import type { Metadata } from "next";
import Header from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import GamePager from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/GamePager";
import GameColumns from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/GameColumns";
import Footer from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";
import EastFilter from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/EastFilter";
import GoogleAdsense from "../../components/GoogleAdsense";
import SeoText from "../../components/SeoText";
import GamePastFilter from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/GamePastFilter";
import { getPastDateLists } from "../../lib/past-dates";
import { getSnapshotForRender } from "../../lib/live-snapshot";

/**
 * The three east games, each in a row of its own.
 *
 * They used to be printed as one three-column row, so Sandakan sat on the left,
 * Cash Sweep in the middle and Sabah 88 on the right (reported 11 Oct 2026).
 * Each card now has its own row and takes the left column, the same width and
 * the same place as the card on that game's own page.
 */
/** Left to right: Sabah 88, Cash Sweep, Sandakan. */
/**
 * Sabah 88 is four cards now - its 4D board, then the three Lotto boards the
 * captured card used to carry inside it - so the id list names all four.
 */
const EAST_ROWS = [
  "table-10-2026-09-06",
  "table-10-2026-09-06-lotto645",
  "table-10-2026-09-06-lotto5",
  "table-10-2026-09-06-lotto6",
  "table-9-2026-09-06",
  "table-8-2026-09-06",
];

export const metadata: Metadata = {
  alternates: { canonical: "/sabah-sarawak-4d-results" },
  title: "Sabah Sarawak 4d results - Live4dResult",
  description: "Sandakan 4D, Special Cash Sweep and Sabah 88 4D results - Live4dResult.",
};

const OP_NAMES: Record<string, string> = { sandakan: "sandakan", sabah88: "sabah88", cashsweep: "cashsweep" };
const OP_LABEL: Record<string, string> = {
  sandakan: "Sandakan 4D 山打根",
  sabah88: "Sabah 88 4D 沙巴88",
  cashsweep: "Cash Sweep 4D 沙捞越",
  east: "Sabah Sarawak 4D 东马",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ op?: string }> }) {
  const sp = await searchParams;
  const op = sp && sp.op ? OP_NAMES[sp.op] : undefined;
  const slug = op || "east";
  const pastDates = await getPastDateLists();
  const myDates = pastDates.my;
  // Same rule as the home page: a render never waits on the operator sweep, or
  // the app sits on its splash for seconds before this page's first byte.
  const snap = await getSnapshotForRender().catch(() => null);
  const snapProp = snap
    ? { cards: snap.cards, perdana: snap.perdana, hari: snap.hari, gd6: snap.gd6, gdjp7: snap.gdjp7, nine6: snap.nine6, nineJp: snap.nineJp }
    : undefined;
  return (
    <>
      <Header />
      <RegionButtons />
      {op ? (
        <div className="d-lg-none">
          <GamePager name={op || "sabah88"} pastDates={pastDates} showPast />
        </div>
      ) : null}
      <div className={"mkt-past-scope" + (op ? " d-none d-lg-block" : "")}>
        <main className="container flex-shrink-0">
          <div className="row">
            <div className="col-sm-12">
              <GamePastFilter slug={slug} name={OP_LABEL[slug]} kind="my" dates={myDates} tables={pastDates.myTables} />
            </div>
          </div>
          {/* The three cards sit side by side, like the 4D Result page. */}
          <GameColumns ids={EAST_ROWS} snap={snapProp} />
        </main>
      </div>
      <EastFilter />
      <SeoText
        heading="Sabah Sarawak 4D Results 东马开彩结果"
        paragraphs={[
          "Live Sabah Sarawak 4D results: Sandakan 4D 山打根赛马会, Sabah 88 4D 沙巴万字 and Special Cash Sweep 4D 砂拉越大万, updated within seconds of every official draw.",
          "Each card shows the draw date, draw number, the 1st, 2nd and 3rd prize numbers, all Special 特别奖 and Consolation 安慰奖 numbers, plus the 3D and lotto jackpot prizes where the operator publishes them.",
          "Sandakan 4D, Sabah 88 4D and Special Cash Sweep 4D draw on their own weekly schedules - the card always shows that game's latest published draw and date."
        ]}
        links={[
          { href: "/east/stc", label: "Sandakan 4D 山打根" },
          { href: "/east/sabah88", label: "Sabah 88 4D 沙巴88" },
          { href: "/east/cashsweep", label: "Cash Sweep 沙捞越" },
          { href: "/past-results", label: "Past Results" },
          { href: "/number-history", label: "Number History" }
        ]}
      />
      <Footer />
      <GoogleAdsense />
    </>
  );
}


