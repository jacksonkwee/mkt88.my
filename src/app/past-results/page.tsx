import type { Metadata } from "next";
import Header from "../../components/sites/mkt88/app/Header";
import RegionButtons from "../../components/sites/mkt88/app/RegionButtons";
import PastResultsView from "../../components/sites/mkt88/app/PastResultsView";
import { DEFAULT_PAST_DATE } from "../../components/sites/mkt88/app/past-data";
import Footer from "../../components/sites/mkt88/app/Footer";
import GoogleAdsense from "../../components/GoogleAdsense";
import SeoText from "../../components/SeoText";
import { getPastDateLists } from "../../lib/past-dates";

export const metadata: Metadata = {
  alternates: { canonical: "/past-results" },
  title: "Past Results - Live4dResult",
  description: "Past 4D draw results for Magnum, Sports Toto, DaMaCai, Singapore Pools and more.",
};

// The default date is the newest draw in the app's own archive, so it has to be
// resolved when the page is requested rather than frozen into the build.
export const dynamic = "force-dynamic";

export default async function PastResultsPage() {
  const { my } = await getPastDateLists();
  const latest = my[my.length - 1] || DEFAULT_PAST_DATE;
  return (
    <>
      <Header />
      <RegionButtons />
      <PastResultsView date={latest} />
      <SeoText
        heading="Past 4D Results 过去开彩记录"
        paragraphs={[
          "Browse past 4D draw results by date for Malaysia, Singapore and Cambodia - Magnum 4D, Magnum Life, Magnum Jackpot Gold, Da Ma Cai 1+3D, Sports Toto 4D / 5D / 6D, Singapore Pools 4D, Sandakan 4D, Sabah 88 4D, Special Cash Sweep 4D, Grand Dragon 4D / 6D, Nine Lotto, Perdana 4D and Lucky HariHari.",
          "Use the calendar or the Malaysia & Singapore / Cambodia tabs at the top to pick a date. Every day is kept, so you can look back at older draws any time.",
          "Looking for one number instead of one date? Use Number History 开彩记录 to see every draw a specific number has appeared in since 1985."
        ]}
        links={[
          { href: "/number-history", label: "Number History 开彩记录" },
          { href: "/", label: "Today's Live Results" },
          { href: "/lotto-4d", label: "Lotto 4D 柬埔寨" }
        ]}
      />
      <Footer />
      <GoogleAdsense />
    </>
  );
}



