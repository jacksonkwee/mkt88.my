import { Suspense } from "react";
import type { Metadata } from "next";
import FavouritesApp from "../../components/FavouritesApp";
import Footer from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";
import SeoText from "../../components/SeoText";

export const metadata: Metadata = {
  title: "Favourite Numbers 收藏号码 - Yellow Highlight & Alerts | mkt88.my",
  description: "Add your favourite 4D numbers: they glow yellow on the live results and you get an alert the moment they are drawn. Pick permutations (Pau) and the prizes to watch.",
  alternates: { canonical: "https://www.mkt88.my/favourites" },
};

export default function FavouritesPage() {
  return (
    <>
    {/* The screen's name is drawn by the red bar as a plain div, so the page
        carried no h1 at all. */}
    <h1 className="sr-only">Favourite Numbers 收藏号码 - MKT 88 4D</h1>
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>Loading…</div>}>
      <FavouritesApp />
    </Suspense>
    <Footer />
    </>
  );
}


