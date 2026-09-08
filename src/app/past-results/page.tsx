import type { Metadata } from "next";
import Header from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import PastResultsView from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/PastResultsView";
import { DEFAULT_PAST_DATE } from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/past-data";
import Footer from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";

export const metadata: Metadata = {
  title: "Past Results - Live4dResult",
  description: "Past 4D draw results for Magnum, Sports Toto, DaMaCai, Singapore Pools and more.",
};

export default function PastResultsPage() {
  return (
    <>
      <Header />
      <RegionButtons />
      <PastResultsView date={DEFAULT_PAST_DATE} />
      <Footer />
    </>
  );
}

