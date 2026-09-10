import type { Metadata } from "next";
import Header from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import SnapshotPage from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/SnapshotPage";
import GamePager from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/GamePager";
import Footer from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";
import raw from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/snapshots/sabah-sarawak-4d-results.content.json";
import EastFilter from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/EastFilter";
import GoogleAdsense from "../../components/GoogleAdsense";
import SeoText from "../../components/SeoText";

export const metadata: Metadata = {
  alternates: { canonical: "/sabah-sarawak-4d-results" },
  title: "Sabah Sarawak 4d results - Live4dResult",
  description: "Sandakan 4D, Special Cash Sweep and Sabah 88 4D results - Live4dResult.",
};

const OP_NAMES: Record<string, string> = { sandakan: "sandakan", sabah88: "sabah88", cashsweep: "cashsweep" };

export default async function Page({ searchParams }: { searchParams: Promise<{ op?: string }> }) {
  const { colHtml } = raw as { colHtml: string };
  const sp = await searchParams;
  const op = sp && sp.op ? OP_NAMES[sp.op] : undefined;
  return (
    <>
      <Header />
      <RegionButtons />
      {op ? (
        <div className="d-lg-none">
          <GamePager name={op} />
        </div>
      ) : null}
      <div className={op ? "d-none d-lg-block" : undefined}>
        <SnapshotPage html={colHtml} />
      </div>
      <EastFilter />
      <SeoText
        heading="Sabah Sarawak 4D Results 東馬開彩結果"
        paragraphs={[
          "Live Sabah Sarawak 4D results: Sandakan 4D 山打根赛马会, Sabah 88 4D 沙巴萬字 and Special Cash Sweep 4D 砂勞越大萬, updated within seconds of every official draw.",
          "Each card shows the draw date, draw number, the 1st, 2nd and 3rd prize numbers, all Special 特別獎 and Consolation 安慰獎 numbers, plus the 3D and lotto jackpot prizes where the operator publishes them.",
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


