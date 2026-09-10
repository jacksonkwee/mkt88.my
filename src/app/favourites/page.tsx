import { Suspense } from "react";
import type { Metadata } from "next";
import FavouritesApp from "../../components/FavouritesApp";

export const metadata: Metadata = {
  title: "Favourite Numbers 收藏号码 - Yellow Highlight & Alerts | mkt88.my",
  description: "Add your favourite 4D numbers: they glow yellow on the live results and you get an alert the moment they are drawn. Pick permutations (Pau) and the prizes to watch.",
  alternates: { canonical: "https://www.mkt88.my/favourites" },
};

export default function FavouritesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>Loading…</div>}>
      <FavouritesApp />
    </Suspense>
  );
}
