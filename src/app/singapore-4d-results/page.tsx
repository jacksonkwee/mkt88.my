import type { Metadata } from "next";
import Header from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import SnapshotPage from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/SnapshotPage";
import Footer from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";
import raw from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/snapshots/singapore-4d-results.content.json";
import GoogleAdsense from "../../components/GoogleAdsense";

export const metadata: Metadata = {
  title: "Singapore Pools › singapore 4d results.",
  description: "Singapore 4D and Singapore Toto results - Live4dResult.",
};

export default function Page() {
  const { colHtml } = raw as { colHtml: string };
  return (
    <>
      <Header />
      <RegionButtons />
      <SnapshotPage html={colHtml} />
      <Footer />
      <GoogleAdsense />
    </>
  );
}
