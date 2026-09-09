import type { Metadata } from "next";
import Header from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import GameQuickLinks from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/GameQuickLinks";
import LotteryGrid from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/LotteryGrid";
import Footer from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";
import LiveResults from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/LiveResults";
import DirectTopAd from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/DirectTopAd";
import GoogleAdsense from "../../components/GoogleAdsense";

export const metadata: Metadata = {
  title: "4D Results - Magnum, Sports Toto, DaMaCai, Grand Dragon, Nine Lotto | 恭喜发财 4D",
  description:
    "Live 4D results for Magnum, Sports Toto 4D, DaMaCai, Singapore Pools, Sandakan, Sabah 88, Cash Sweep, Grand Dragon, Perdana, Nine Lotto and Lucky HariHari. Fast and accurate 4D draw results.",
  alternates: { canonical: "https://www.mkt88.my/" },
};

export default function FourDResultsPage() {
  return (
    <>
      <Header />
      <RegionButtons />
      <GameQuickLinks />
      <main className="container flex-shrink-0">
        <div className="row">
          <div className="col-sm-12">
            <DirectTopAd />
            <LotteryGrid />
          </div>
        </div>
      </main>
      <Footer />
      <GoogleAdsense />
      <LiveResults />
    </>
  );
}
