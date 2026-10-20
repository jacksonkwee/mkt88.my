import { Suspense } from "react";
import type { Metadata } from "next";
import DaBoGongApp from "../../components/DaBoGongApp";
import Footer from "../../components/sites/mkt88/app/Footer";

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
      <Footer />
    </>
  );
}
