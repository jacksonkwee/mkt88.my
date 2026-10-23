import type { Metadata } from "next";
import Header from "../../../components/sites/mkt88/app/Header";
import RegionButtons from "../../../components/sites/mkt88/app/RegionButtons";
import Footer from "../../../components/sites/mkt88/app/Footer";
import GoogleAdsense from "../../../components/GoogleAdsense";
import { getSnapshot } from "../../../lib/live-snapshot";

const PATH = "/result/magnum-4d-jackpot";

export const metadata: Metadata = {
  title: "Magnum 4D Jackpot Result 万能 4D 积宝 - Jackpot 1 & 2 Prize Today",
  description:
    "Magnum 4D Jackpot 1 and Jackpot 2 prize amounts for the latest draw, updated after every Magnum draw, plus 4D Jackpot Gold and the draw schedule.",
  alternates: { canonical: PATH },
  openGraph: {
    title: "Magnum 4D Jackpot Result - Jackpot 1 & 2 Prize",
    description: "Current Magnum 4D Jackpot 1 and Jackpot 2 prize amounts after each draw.",
    url: "https://www.mkt88.my" + PATH,
    type: "website",
  },
};

type Card = Record<string, string>;

const money = (v?: string) => (v && v.trim() ? v.trim() : "----");

export default async function MagnumJackpotPage() {
  // A failed snapshot must not break the page: the headings and the explanation
  // are the part Google indexes, and the amounts fall back to "----".
  const snap = await getSnapshot().catch(() => null);
  const jackpot: Card = (snap?.cards?.["table-1"] || {}) as Card;
  const gold: Card = (snap?.cards?.["table-2"] || {}) as Card;

  const drawDate = gold.date || jackpot.date || "";
  const drawNo = gold.draw_no || jackpot.draw_no || "";
  const jp1 = money(jackpot.first_jackpot_prize);
  const jp2 = money(jackpot.second_jackpot_prize);
  const gold1 = money(gold.first_jackpot_prize);
  const gold2 = money(gold.second_jackpot_prize);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Magnum 4D Jackpot Result",
    url: "https://www.mkt88.my" + PATH,
    description:
      "Magnum 4D Jackpot 1 and Jackpot 2 prize amounts for the latest draw, updated after every draw.",
    isPartOf: { "@type": "WebSite", name: "MKT88 4D Results", url: "https://www.mkt88.my/" },
    about: {
      "@type": "Thing",
      name: "Magnum 4D Jackpot",
      description: "Malaysia Magnum 4D Jackpot 1 and Jackpot 2 prize pool.",
    },
  };

  return (
    <>
      <Header />
      <RegionButtons />
      <main className="container py-4">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <h1 className="h3 mb-1">Magnum 4D Jackpot Result 万能 4D 积宝</h1>
        <p className="text-muted mb-4">
          Jackpot 1 and Jackpot 2 prize amounts for the latest draw
          {drawNo ? ` · Draw ${drawNo}` : ""}
          {drawDate ? ` · ${drawDate}` : ""}
        </p>

        <div className="row g-3 mb-4">
          <div className="col-md-6">
            <div className="border rounded p-3 h-100">
              <div className="text-muted small">Magnum 4D Jackpot 1</div>
              <div className="h4 mb-0">{jp1}</div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="border rounded p-3 h-100">
              <div className="text-muted small">Magnum 4D Jackpot 2</div>
              <div className="h4 mb-0">{jp2}</div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="border rounded p-3 h-100">
              <div className="text-muted small">4D Jackpot Gold 1</div>
              <div className="h5 mb-0">{gold1}</div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="border rounded p-3 h-100">
              <div className="text-muted small">4D Jackpot Gold 2</div>
              <div className="h5 mb-0">{gold2}</div>
            </div>
          </div>
        </div>

        <h2 className="h5 mt-4">What is the Magnum 4D Jackpot?</h2>
        <p>
          Magnum 4D Jackpot is a separate game played alongside the normal Magnum 4D draw. Instead of
          matching a single four-digit number, a ticket carries a set of numbers and wins Jackpot 1 or
          Jackpot 2 when the drawn combination matches. Both jackpots roll over to the next draw when
          nobody wins them, which is why the amounts can climb into the millions of ringgit.
        </p>
        <p>
          Magnum also runs <strong>4D Jackpot Gold</strong>, which uses six digits plus a golden number
          and has its own two prize pools. The figures above show all four pools, updated after each
          draw.
        </p>

        <h2 className="h5 mt-4">When does Magnum draw?</h2>
        <p>
          Magnum 4D, 4D Jackpot and 4D Jackpot Gold are drawn three times a week, usually on Wednesday,
          Saturday and Sunday in the evening. Results and the new jackpot amounts are published shortly
          after each draw.
        </p>

        <h2 className="h5 mt-4">See the full Magnum result</h2>
        <p className="mb-1">
          <a href="/result/magnum">Magnum 4D full result (1st, 2nd, 3rd, Special, Consolation)</a>
        </p>
        <p className="mb-1">
          <a href="/number-history">Check how often your number has been drawn</a>
        </p>
        <p className="mb-0">
          <a href="/draw-schedule">Full 4D draw schedule</a>
        </p>
      </main>
      <Footer />
      <GoogleAdsense />
    </>
  );
}
