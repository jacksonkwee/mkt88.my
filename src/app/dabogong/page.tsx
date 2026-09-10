import { Suspense } from "react";
import type { Metadata } from "next";
import DaBoGongApp from "../../components/DaBoGongApp";

export const metadata: Metadata = {
  title: "大伯公 千字图万字图 - 号码含义查询 | mkt88.my",
  description: "输入 3-4 位数，查看大伯公千字图 / 万字图的号码含义与图片。Type a 3-4 digit number to see its 4D picture and meaning.",
};

export default function DaBoGongPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>Loading…</div>}>
      <DaBoGongApp />
    </Suspense>
  );
}
