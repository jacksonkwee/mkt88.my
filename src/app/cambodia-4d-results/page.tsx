import type { Metadata } from "next";
import Header from "../../components/sites/mkt88/app/Header";
import RegionButtons from "../../components/sites/mkt88/app/RegionButtons";
import MultiDrawResults from "../../components/sites/mkt88/app/MultiDrawResults";
import Footer from "../../components/sites/mkt88/app/Footer";
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

