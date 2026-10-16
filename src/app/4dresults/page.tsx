import type { Metadata } from "next";
import Header from "../../components/sites/mkt88/app/Header";
import RegionButtons from "../../components/sites/mkt88/app/RegionButtons";
import LotteryGrid from "../../components/sites/mkt88/app/LotteryGrid";
import Footer from "../../components/sites/mkt88/app/Footer";
import LiveResults from "../../components/sites/mkt88/app/LiveResults";
import DirectTopAd from "../../components/sites/mkt88/app/DirectTopAd";
import GoogleAdsense from "../../components/GoogleAdsense";

export const metadata: Metadata = {
  title: "4D Results - Magnum, Sports Toto, DaMaCai, Grand Dragon, Nine Lotto | 恭喜发财 4D",
  description:
    "Live 4D results for Magnum, Sports Toto 4D, DaMaCai, Singapore Pools, Sandakan, Sabah 88, Cash Sweep, Grand Dragon, Perdana, Nine Lotto and Lucky HariHari. Fast and accurate 4D draw results.",
  alternates: { canonical: "/4dresults" },
};

export default function FourDResultsPage() {
  return (
    <>
      <Header />
      <RegionButtons />
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
