import { Suspense } from "react";
import type { Metadata } from "next";
import NumberHistoryApp from "../../components/NumberHistoryApp";
import SeoText from "../../components/SeoText";

export const metadata: Metadata = {
  title: "Number History 开彩记录 - 4D Number Search, Permutation (Pau) | mkt88.my",
  description: "Search any 4D number: every past draw it appeared in from 25/08/1985 to today, all permutations (Pau 包) and reverse (来回), with region, prize and company filters plus the 大伯公 meaning.",
  alternates: { canonical: "https://www.mkt88.my/number-history" },
};

export default function NumberHistoryPage() {
  return (
    <>
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>Loading…</div>}>
      <NumberHistoryApp />
    </Suspense>
    <SeoText
      heading="4D Number History 开彩记录 - 号码历史查询"
      paragraphs={[
        "搜尋任何 4 位數號碼，即可看到它在每一個彩票公司（Magnum 萬能、Da Ma Cai 大馬彩、Sports Toto 多多、Singapore Pools、Grand Dragon 豪龍、Nine Lotto、Sabah 88、Sandakan、Cash Sweep、Perdana、Lucky HariHari）的开彩记录，最早可追溯到 25/08/1985。",
        "Use Pau 包 to check every permutation of a number at once, or Reverse 来回 to check the number and its reverse (for example 1782 and 2871). Filter the list by region (M'sia, Sab, Sar, Spore, Others), by prize (1st, 2nd, 3rd, Special, Consolation) or by game company.",
        "Each result shows the draw date, the game, the prize type and the winning number, with the 大伯公 picture and meaning shown under the search bar."
      ]}
      links={[
        { href: "/", label: "Live 4D Results" },
        { href: "/dabogong", label: "大伯公 千字图万字图" },
        { href: "/past-results", label: "Past Results" },
        { href: "/favourites", label: "Favourite Numbers" }
      ]}
    />
    </>
  );
}


