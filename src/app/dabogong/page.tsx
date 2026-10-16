import { Suspense } from "react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import DaBoGongApp from "../../components/DaBoGongApp";
import SeoText from "../../components/SeoText";
import Footer from "../../components/sites/mkt88/app/Footer";

export const metadata: Metadata = {
  title: "大伯公 千字图万字图 - 号码含义查询 | mkt88.my",
  description: "输入 3-4 位数或词语（中文 / English / Bahasa Malaysia），查看大伯公千字图 / 万字图的号码含义与图片。例如 666 = 羊角豆 (okra / bendi)，狗 / dog / anjing 列出所有相关号码。",
  alternates: { canonical: "/dabogong" },
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

export default function DaBoGongPage() {
  return (
    <>
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>Loading…</div>}>
      <DaBoGongApp />
    </Suspense>
    <SeoText
      heading={
        <L
          en="Dabogong 1,000 and 10,000 Number Charts - Number Meaning Look-up"
          ms="Carta Nombor Dabogong 1,000 dan 10,000 - Cari Maksud Nombor"
          zh="大伯公 千字图万字图 - 号码含义查询"
        />
      }
      paragraphs={[
        <L
          en="Type any 3- or 4-digit number, or a word, to see that number's 1,000-number / 10,000-number chart picture and meaning. For example 666 is okra (bendi), and 0511 means elder uncle."
          ms="Taip sebarang nombor 3 atau 4 digit, atau satu perkataan, untuk melihat gambar dan maksud carta 1,000 / 10,000 nombor bagi nombor itu. Contohnya 666 ialah bendi (okra), dan 0511 bermaksud pak cik tua."
          zh="输入任何 3 位或 4 位号码，或输入词语，就能查看该号码的千字图 / 万字图图片与含义。例如 666 是羊角豆 (okra / bendi)，0511 是大伯 (elder uncle)。"
        />,
        <L
          en="Search in Chinese, English or Bahasa Malaysia: “狗”, “dog” or “anjing” all list every number related to dogs, such as 125 dogfight, 177 dog mating, 0529 house dog, 8261 stray dogs."
          ms="Cari dalam bahasa Cina, Inggeris atau Bahasa Malaysia: “狗”, “dog” atau “anjing” semuanya menyenaraikan setiap nombor berkaitan anjing, seperti 125 anjing bergaduh, 177 perkahwinan anjing, 0529 anjing rumah, 8261 anjing liar."
          zh="支持中文、English 与 Bahasa Malaysia 搜索：输入「狗」、「dog」或「anjing」都会列出所有与狗有关的号码，例如 125 狗打架、177 狗亲密、0529 狗、8261 流浪狗。"
        />,
        <L
          en="Digits: 4 digits show the 10,000-number chart, 3 digits show the Dabogong 1,000-number chart. All pictures and meanings are for entertainment and reference only."
          ms="Digit: 4 digit memaparkan carta 10,000 nombor, 3 digit memaparkan carta 1,000 nombor Dabogong. Semua gambar dan maksud adalah untuk hiburan dan rujukan sahaja."
          zh="位数：4 位数显示万字图，3 位数显示大伯公千字图。所有图片与含义仅供娱乐与参考。"
        />
      ]}
      links={[
        { href: "/number-history", label: <L en="Number History" ms="Sejarah Nombor" zh="开彩记录" /> },
        { href: "/lotto-4d", label: <L en="Lotto 4D Results" ms="Keputusan Lotto 4D" zh="Lotto 4D 结果" /> },
        { href: "/past-results", label: <L en="Past Results" ms="Keputusan Lalu" zh="过去开彩" /> },
        { href: "/favourites", label: <L en="Favourite Numbers" ms="Nombor Kegemaran" zh="收藏号码" /> }
      ]}
    />
    <Footer />
    </>
  );
}



