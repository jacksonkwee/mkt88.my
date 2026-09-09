import type { Metadata } from "next";
import Header from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import SnapshotPage from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/SnapshotPage";
import Footer from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";
import raw from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/snapshots/sabah-sarawak-4d-results.content.json";
import EastFilter from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/EastFilter";
import GoogleAdsense from "../../components/GoogleAdsense";

export const metadata: Metadata = {
  title: "Sabah Sarawak 4d results - Live4dResult",
  description: "Sandakan 4D, Special Cash Sweep and Sabah 88 4D results - Live4dResult.",
};

export default function Page() {
  const { colHtml } = raw as { colHtml: string };
  return (
    <>
      <Header />
      <RegionButtons />
      <SnapshotPage html={colHtml} />
      <EastFilter />
      <Footer />
      <GoogleAdsense />
    </>
  );
}
