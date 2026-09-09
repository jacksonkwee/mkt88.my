import type { Metadata } from "next";
import Header from "../../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import PastResultsView from "../../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/PastResultsView";
import Footer from "../../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";
import { PAST_DATES } from "../../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/past-data";
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
      <RegionButtons />
      <PastResultsView date={date} view="kh" />
      <Footer />
      {PAST_DATES.includes(date) ? <GoogleAdsense /> : null}
    </>
  );
}

