import { Suspense } from "react";
import type { Metadata } from "next";
import NumberHistoryApp from "../../components/NumberHistoryApp";

export const metadata: Metadata = {
  title: "Number History 开彩记录 - 4D Number Search, Permutation (Pau) | mkt88.my",
  description: "Search any 4D number: every past draw it appeared in from 25/08/1985 to today, all permutations (Pau 包) and reverse (来回), with region, prize and company filters plus the 大伯公 meaning.",
  alternates: { canonical: "https://www.mkt88.my/number-history" },
};

export default function NumberHistoryPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>Loading…</div>}>
      <NumberHistoryApp />
    </Suspense>
  );
}
