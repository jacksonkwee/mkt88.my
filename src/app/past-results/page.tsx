import type { Metadata } from "next";
import Header from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import PastResultsView from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/PastResultsView";
import { DEFAULT_PAST_DATE } from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/past-data";
import Footer from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";
import GoogleAdsense from "../../components/GoogleAdsense";
import SeoText from "../../components/SeoText";

export const metadata: Metadata = {
  alternates: { canonical: "/past-results" },
  title: "Past Results - Live4dResult",
  description: "Past 4D draw results for Magnum, Sports Toto, DaMaCai, Singapore Pools and more.",
};

export default function PastResultsPage() {
  return (
    <>
      <Header />
      <RegionButtons />
      <PastResultsView date={DEFAULT_PAST_DATE} />
      <SeoText
        heading="Past 4D Results 過去開彩記錄"
        paragraphs={[
          "Browse past 4D draw results by date for Malaysia, Singapore and Cambodia - Magnum 4D, Magnum Life, Magnum Jackpot Gold, Da Ma Cai 1+3D, Sports Toto 4D / 5D / 6D, Singapore Pools 4D, Sandakan 4D, Sabah 88 4D, Special Cash Sweep 4D, Grand Dragon 4D / 6D, Nine Lotto, Perdana 4D and Lucky HariHari.",
          "Use the calendar or the Malaysia & Singapore / Cambodia tabs at the top to pick a date. Every day is kept, so you can look back at older draws any time.",
          "Looking for one number instead of one date? Use Number History 開彩記錄 to see every draw a specific number has appeared in since 1985."
        ]}
        links={[
          { href: "/number-history", label: "Number History 開彩記錄" },
          { href: "/", label: "Today's Live Results" },
          { href: "/lotto-4d", label: "Lotto 4D 柬埔寨" }
        ]}
      />
      <Footer />
      <GoogleAdsense />
    </>
  );
}



