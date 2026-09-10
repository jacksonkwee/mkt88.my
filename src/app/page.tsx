import Header from "../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import LotteryGrid from "../components/sites/live4dresult-net-0600c55d/root-8a5edab2/LotteryGrid";
import Footer from "../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";
import LiveResults from "../components/sites/live4dresult-net-0600c55d/root-8a5edab2/LiveResults";
import { getSnapshot } from "../lib/live-snapshot";
import DirectTopAd from "../components/sites/live4dresult-net-0600c55d/root-8a5edab2/DirectTopAd";
import GoogleAdsense from "../components/GoogleAdsense";
import SeoText from "../components/SeoText";

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
      <SeoText
        heading="Live 4D Results 马来西亚 · Singapore · Cambodia"
        paragraphs={[
          "Live 4D results for every draw: Magnum 4D 萬能, Magnum Life, Magnum Jackpot Gold, Da Ma Cai 1+3D 大馬彩, Sports Toto 4D / 5D / 6D 多多, Singapore Pools 4D 新加坡, Grand Dragon 4D / 6D 豪龍, Nine Lotto 4D / 6D, Sabah 88 4D 沙巴88, Sandakan 4D 山打根, Special Cash Sweep 4D 沙捞越, Perdana 4D 3:30pm / 7:30pm and Lucky HariHari 4D / 6D with the jackpot pool.",
          "Each card shows the draw date, draw number, 1st / 2nd / 3rd prize, all Special 特別獎 and Consolation 安慰獎 numbers, and updates within seconds of the official release - no refresh needed.",
          "Tap any result number to open its Number History 开彩记录 (every draw since 25/08/1985), add numbers to Favourites 收藏号码 for a yellow highlight and alerts, or look up any number's picture and meaning in 大伯公 千字图万字图."
        ]}
        links={[
          { href: "/number-history", label: "Number History 开彩记录" },
          { href: "/dabogong", label: "大伯公 千字图万字图" },
          { href: "/favourites", label: "Favourite Numbers 收藏号码" },
          { href: "/past-results", label: "Past Results 过去开彩" },
          { href: "/lotto-4d", label: "Lotto 4D 柬埔寨" },
          { href: "/singapore-4d-results", label: "Singapore 4D 新加坡" },
          { href: "/sabah-sarawak-4d-results", label: "Sabah Sarawak 東馬" }
        ]}
      />
      <Footer />
      <GoogleAdsense />
      <LiveResults />
    </>
  );
}



