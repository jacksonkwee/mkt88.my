import type { Metadata } from "next";
import Header from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import MultiDrawResults from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/MultiDrawResults";
import Footer from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";
import GoogleAdsense from "../../components/GoogleAdsense";

export const metadata: Metadata = {
  alternates: { canonical: "/cambodia-4d-results" },
  title: "Cambodia 4D, Lotto 4D, Dragon Lotto, Perdana Lottery, Lucky 4D",
  description:
    "Cambodia 4D / Lotto 4D: Grand Dragon Lotto, Perdana Lottery 4D (2 draws), Nine Lotto and Lucky HariHari (2 draws) results.",
};

export default function CambodiaResultsPage() {
  return (
    <>
      <Header />
      <RegionButtons />
      <MultiDrawResults />
      <Footer />
      <GoogleAdsense />
    </>
  );
}

