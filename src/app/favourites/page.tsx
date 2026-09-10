import { Suspense } from "react";
import FavouritesApp from "../../components/FavouritesApp";

export default function FavouritesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>Loading…</div>}>
      <FavouritesApp />
    </Suspense>
  );
}
