import Header from "../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import LotteryGrid from "../components/sites/live4dresult-net-0600c55d/root-8a5edab2/LotteryGrid";
import Footer from "../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";
import LiveResults from "../components/sites/live4dresult-net-0600c55d/root-8a5edab2/LiveResults";
import { getSnapshot } from "../lib/live-snapshot";
import DirectTopAd from "../components/sites/live4dresult-net-0600c55d/root-8a5edab2/DirectTopAd";
import GoogleAdsense from "../components/GoogleAdsense";

export default async function Home() {
  const snap = await getSnapshot().catch(() => null);
  const snapProp = snap ? { cards: snap.cards, perdana: snap.perdana, hari: snap.hari } : undefined;
  return (
    <>
      <Header />
      <RegionButtons />
      <main className="container flex-shrink-0">
        <div className="row">
          <div className="col-sm-12">
            <DirectTopAd />
            <LotteryGrid snap={snapProp} />
          </div>
        </div>
      </main>
      <Footer />
      <GoogleAdsense />
      <LiveResults />
    </>
  );
}


