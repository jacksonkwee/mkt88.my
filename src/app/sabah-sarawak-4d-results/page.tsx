import type { Metadata } from "next";
import Header from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import SnapshotPage from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/SnapshotPage";
import GamePager from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/GamePager";
import Footer from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";
import raw from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/snapshots/sabah-sarawak-4d-results.content.json";
import EastFilter from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/EastFilter";
import GoogleAdsense from "../../components/GoogleAdsense";

export const metadata: Metadata = {
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
      <Footer />
      <GoogleAdsense />
    </>
  );
}
