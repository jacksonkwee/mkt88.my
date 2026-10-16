import type { Metadata } from "next";
import Header from "../../../../components/sites/mkt88/app/Header";
import RegionButtons from "../../../../components/sites/mkt88/app/RegionButtons";
import PastResultsView from "../../../../components/sites/mkt88/app/PastResultsView";
import Footer from "../../../../components/sites/mkt88/app/Footer";
import { PAST_DATES } from "../../../../components/sites/mkt88/app/past-data";
import GoogleAdsense from "../../../../components/GoogleAdsense";

export const metadata: Metadata = {
  title: "Cambodia Past Results - mkt88 4D",
  description: "Cambodia 4D past draw results.",
};

export function generateStaticParams() {
  return PAST_DATES.map((date) => ({ date }));
}

export default async function CambodiaPastDatePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return (
    <>
      <Header />
      {/* Same as the Malaysian date pages: no heading of its own. */}
      <h1 className="sr-only">Cambodia 4D Past Results {date} 柬埔寨开彩记录</h1>
      <RegionButtons />
      <PastResultsView date={date} view="kh" />
      <Footer />
      {PAST_DATES.includes(date) ? <GoogleAdsense /> : null}
    </>
  );
}

