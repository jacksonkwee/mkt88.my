import { Suspense } from "react";
import type { Metadata } from "next";
import FavouritesApp from "../../components/FavouritesApp";
import SeoText from "../../components/SeoText";

export const metadata: Metadata = {
  title: "Favourite Numbers 收藏号码 - Yellow Highlight & Alerts | mkt88.my",
  description: "Add your favourite 4D numbers: they glow yellow on the live results and you get an alert the moment they are drawn. Pick permutations (Pau) and the prizes to watch.",
  alternates: { canonical: "https://www.mkt88.my/favourites" },
};

export default function FavouritesPage() {
  return (
    <>
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>Loading…</div>}>
      <FavouritesApp />
    </Suspense>
    <SeoText
      heading="Favourite Numbers 收藏号码 - 中奖提醒"
      paragraphs={[
        "加入你喜欢的 4D 号码，当它在任何彩票公司的开奖结果出现时，号码会以黄色高亮显示，并可发送特别通知。",
        "Pick a number, choose the permutations (Pau 包) or the reverse pair (来回), then decide which prizes should alert you: Main 正奖, Special 特别奖 or Consolation 安慰奖. Favourites are saved on your own device.",
        "Favourite numbers work together with Number History 开彩记录, where you can see every past draw a number has appeared in since 1985."
      ]}
      links={[
        { href: "/number-history", label: "Number History 开彩记录" },
        { href: "/", label: "Live 4D Results" },
        { href: "/dabogong", label: "大伯公 千字图万字图" }
      ]}
    />
    </>
  );
}


