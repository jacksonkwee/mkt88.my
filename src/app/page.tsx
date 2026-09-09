import Header from "../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import LotteryGrid from "../components/sites/live4dresult-net-0600c55d/root-8a5edab2/LotteryGrid";
import Footer from "../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";
import LiveResults from "../components/sites/live4dresult-net-0600c55d/root-8a5edab2/LiveResults";
import DirectTopAd from "../components/sites/live4dresult-net-0600c55d/root-8a5edab2/DirectTopAd";
import GoogleAdsense from "../components/GoogleAdsense";

export default function Home() {
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

