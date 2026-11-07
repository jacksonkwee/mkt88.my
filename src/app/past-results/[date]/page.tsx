import type { Metadata } from "next";
import Header from "../../../components/sites/mkt88/app/Header";
import RegionButtons from "../../../components/sites/mkt88/app/RegionButtons";
import PastResultsView from "../../../components/sites/mkt88/app/PastResultsView";
import Footer from "../../../components/sites/mkt88/app/Footer";
import { PAST_DATES } from "../../../components/sites/mkt88/app/past-data";
import GoogleAdsense from "../../../components/GoogleAdsense";

export const metadata: Metadata = {
  title: "Past Results - Live4dResult",
  description: "Past 4D draw results for Magnum, Sports Toto, DaMaCai, Singapore Pools and more.",
};

// The app's own archive is read at request time. Pre-rendering this route
// during a build froze whichever dates happened to be present on that machine.
export const dynamic = "force-dynamic";

export default async function PastDatePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return (
    <>
      <Header />
      {/* The date pages show a toolbar and the captured tables, with no heading
          of their own (measured 14 Oct 2026). */}
      <h1 className="sr-only">Past 4D Results {date} 过去开彩记录</h1>
      <RegionButtons />
      <PastResultsView date={date} />
      <Footer />
      {PAST_DATES.includes(date) ? <GoogleAdsense /> : null}
    </>
  );
}


