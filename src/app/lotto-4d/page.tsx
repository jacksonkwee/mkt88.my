import type { Metadata } from "next";
import Header from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import GameQuickLinks from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/GameQuickLinks";
import Lotto4DPage from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Lotto4DPage";
import Footer from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";
import GoogleAdsense from "../../components/GoogleAdsense";

export const metadata: Metadata = {
  title: "Lotto 4D, 豪龙4D - 4D Dragon, gdlotto, 9 Lotto, Dragon 4D",
  description:
    "Grand Dragon Lotto 4D, Perdana Lottery 4D (2 draws), Nine Lotto and Lucky HariHari (2 draws) live results.",
};

export default function Lotto4d() {
  return (
    <>
      <Header />
      <RegionButtons />
      <GameQuickLinks />
      <Lotto4DPage />
      <Footer />
      <GoogleAdsense />
    </>
  );
}
