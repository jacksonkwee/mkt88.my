import { Suspense } from "react";
import type { Metadata } from "next";
import DaBoGongApp from "../../components/DaBoGongApp";
import SeoText from "../../components/SeoText";

export const metadata: Metadata = {
  title: "大伯公 千字图万字图 - 号码含义查询 | mkt88.my",
  description: "输入 3-4 位数或词语（中文 / English / Bahasa Malaysia），查看大伯公千字图 / 万字图的号码含义与图片。例如 666 = 羊角豆 (okra / bendi)，狗 / dog / anjing 列出所有相关号码。",
  alternates: { canonical: "/dabogong" },
};

export default function DaBoGongPage() {
  return (
    <>
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>Loading…</div>}>
      <DaBoGongApp />
    </Suspense>
    <SeoText
      heading="大伯公 千字图万字图 - 号码含义查询"
      paragraphs={[
        "输入任何 3 位或 4 位号码，或输入词语，就能查看该号码的千字图 / 万字图图片与含义。例如 666 是羊角豆 (okra / bendi)，0511 是大伯 (elder uncle)。",
        "支持中文、English 与 Bahasa Malaysia 搜索：输入「狗」、「dog」或「anjing」都会列出所有与狗有关的号码，例如 125 狗打架、177 狗亲密、0529 狗、8261 流浪狗。",
        "Digits: 4 digits show 万字图 (10,000 number pictures), 3 digits show 大伯公千字图 (1,000 pictures). All pictures and meanings are for entertainment and reference only."
      ]}
      links={[
        { href: "/number-history", label: "Number History 开彩记录" },
        { href: "/lotto-4d", label: "Lotto 4D 结果" },
        { href: "/past-results", label: "Past Results" },
        { href: "/favourites", label: "Favourite Numbers 收藏号码" }
      ]}
    />
    </>
  );
}



