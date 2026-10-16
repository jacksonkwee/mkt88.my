import { Suspense } from "react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import NumberHistoryApp from "../../components/NumberHistoryApp";
import SeoText from "../../components/SeoText";
import Footer from "../../components/sites/mkt88/app/Footer";

export const metadata: Metadata = {
  title: "Number History 开彩记录 - 4D Number Search, Permutation (Pau) | mkt88.my",
  description: "Search any 4D number: every past draw it appeared in from 25/08/1985 to today, all permutations (Pau 包) and reverse (来回), with region, prize and company filters plus the 大伯公 meaning.",
  alternates: { canonical: "https://www.mkt88.my/number-history" },
};

/**
 * One label in three languages.
 *
 * The page is built once and served as static HTML, so all three languages sit
 * in the markup and globals.css shows only the one the reader chose - keyed on
 * data-lang, which the language setting writes onto <html>.
 */
function L({ en, ms, zh }: { en: ReactNode; ms: ReactNode; zh: ReactNode }) {
  return (
    <>
      <span className="L-en">{en}</span>
      <span className="L-ms">{ms}</span>
      <span className="L-zh">{zh}</span>
    </>
  );
}

export default function NumberHistoryPage() {
  return (
    <>
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>Loading…</div>}>
      <NumberHistoryApp />
    </Suspense>
    <SeoText
      heading={
        <L
          en="4D Number History - Number Search and Permutations"
          ms="Sejarah Nombor 4D - Cari Nombor dan Susunan"
          zh="4D 开彩记录 号码历史查询"
        />
      }
      paragraphs={[
        <L
          en="Search any 4-digit number and see every draw it appeared in, across all the game companies (Magnum 4D, Da Ma Cai 1+3D, Sports Toto 4D, Singapore 4D, Grand Dragon, Nine Lotto, Sabah 88, Sandakan, Cash Sweep, Perdana, Lucky HariHari), going back to 25/08/1985."
          ms="Cari mana-mana nombor 4 digit dan lihat setiap cabutan ia muncul, merentas semua syarikat permainan (Magnum 4D, Da Ma Cai 1+3D, Sports Toto 4D, Singapore 4D, Grand Dragon, Nine Lotto, Sabah 88, Sandakan, Cash Sweep, Perdana, Lucky HariHari), sejak 25/08/1985."
          zh="搜索任何 4 位数号码，即可看到它在每一个彩票公司（Magnum 万能、Da Ma Cai 大马彩、Sports Toto 多多、Singapore 4D、Grand Dragon 豪龙、Nine Lotto、Sabah 88、Sandakan、Cash Sweep、Perdana、Lucky HariHari）的开彩记录，最早可追溯到 25/08/1985。"
        />,
        <L
          en="Use Pau to check every permutation of a number at once, or Reverse to check the number and its reverse (for example 1236 and 6321). Filter the list by region (M'sia, Sab, Sar, Spore, Others), by prize (1st, 2nd, 3rd, Special, Consolation) or by game company."
          ms="Guna Pau untuk menyemak setiap susunan nombor sekali gus, atau Reverse untuk menyemak nombor itu dan sonsangannya (contohnya 1236 dan 6321). Tapis senarai mengikut wilayah (M'sia, Sab, Sar, Spore, Lain-lain), mengikut hadiah (1st, 2nd, 3rd, Istimewa, Saguhati) atau mengikut syarikat permainan."
          zh="用 Pau 包 一次过查看一个号码的所有排列，或用 Reverse 来回 查看号码本身与其倒转（例如 1236 和 6321）。可以用地区（M'sia、Sab, Sar、Spore、Others）、奖项（1st、2nd、3rd、特别奖、安慰奖）或彩票公司来筛选列表。"
        />,
        <L
          en="Each result shows the draw date, the game, the prize type and the winning number, with the Dabogong picture and meaning shown under the search bar."
          ms="Setiap hasil menunjukkan tarikh cabutan, permainan, jenis hadiah dan nombor yang menang, dengan gambar dan maksud Dabogong dipaparkan di bawah bar carian."
          zh="每一笔记录会显示开彩日期、游戏、奖项类别与中奖号码；搜索栏下方也会显示该号码的大伯公图片与含义。"
        />
      ]}
      links={[
        { href: "/", label: <L en="Live 4D Results" ms="Keputusan 4D Langsung" zh="最新开奖" /> },
        { href: "/dabogong", label: <L en="Dabogong Number Chart" ms="Carta Nombor Dabogong" zh="大伯公 千字图万字图" /> },
        { href: "/past-results", label: <L en="Past Results" ms="Keputusan Lalu" zh="过去开彩" /> },
        { href: "/favourites", label: <L en="Favourite Numbers" ms="Nombor Kegemaran" zh="收藏号码" /> }
      ]}
    />
    <Footer />
    </>
  );
}


