import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import SnapshotPage from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/SnapshotPage";
import Footer from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";
import raw from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/snapshots/sabah-sarawak-4d-results.content.json";

const OPS: Record<string, { cls: string; title: string; desc: string }> = {
  stc: { cls: "table-8", title: "Sandakan 4D 山打根赛马会 Result", desc: "Sandakan 4D live results." },
  sabah88: { cls: "table-10", title: "Sabah 88 4D 沙巴萬字 Result", desc: "Sabah 88 4D live results." },
  cashsweep: { cls: "table-9", title: "Special Cash Sweep 4D 砂勞越大萬 Result", desc: "Special Cash Sweep 4D live results." },
};

const html = (raw as { colHtml: string }).colHtml || "";

function extractCard(prefix: string): string {
  const key = "card outer-box " + prefix;
  const s = html.indexOf(key);
  if (s < 0) return "";
  let i = s; let depth = 0;
  while (i < html.length) {
    const open = html.indexOf("<div", i);
    const close = html.indexOf("</div>", i);
    if (close === -1 || (open !== -1 && open < close)) { depth++; i = open + 4; }
    else { depth--; i = close + 6; if (depth === 0) break; }
  }
  return html.slice(s, i);
}

export async function generateStaticParams() {
  return Object.keys(OPS).map((op) => ({ op }));
}

export async function generateMetadata({ params }: { params: Promise<{ op: string }> }): Promise<Metadata> {
  const { op } = await params;
  const o = OPS[op];
  if (!o) return { title: "4D Result" };
  return { title: o.title, description: o.desc };
}

export default async function EastPage({ params }: { params: Promise<{ op: string }> }) {
  const { op } = await params;
  const o = OPS[op];
  if (!o) notFound();
  const cardHtml = extractCard(o.cls);
  const wrapped = '<div id="row"><div class="row"><div class="col-12 col-sm-12 col-md-6 col-lg-4 mt-3 px-1">' + cardHtml + "</div></div></div>";
  return (
    <>
      <Header />
      <RegionButtons />
      <SnapshotPage html={wrapped} />
      <Footer />
    </>
  );
}
