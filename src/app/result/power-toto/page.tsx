import type { Metadata } from "next";
import Header from "../../../components/sites/mkt88/app/Header";
import RegionButtons from "../../../components/sites/mkt88/app/RegionButtons";
import Footer from "../../../components/sites/mkt88/app/Footer";
import GoogleAdsense from "../../../components/GoogleAdsense";
import { getSnapshot } from "../../../lib/live-snapshot";

const PATH = "/result/power-toto";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Power Toto 6/55 Result Today - Winning Numbers & Jackpot Prize",
  description:
    "Latest Power Toto 6/55 winning numbers and jackpot prize from Sports Toto Malaysia, updated after every draw.",
  alternates: { canonical: PATH },
  openGraph: {
    title: "Power Toto 6/55 Result - Winning Numbers & Jackpot",
    description: "Current Power Toto 6/55 winning numbers and jackpot amount after each Sports Toto draw.",
    url: "https://www.mkt88.my" + PATH,
    type: "website",
  },
};

type Card = Record<string, string>;

const value = (v?: string) => (v && v.trim() ? v.trim() : "----");

export default async function PowerTotoPage() {
  const snap = await getSnapshot({ wait: true }).catch(() => null);
  const toto: Card = (snap?.cards?.["table-7"] || {}) as Card;
  const numbers = Array.from({ length: 6 }, (_, i) => value(toto["power_toto_number_" + (i + 1)]));
  const jackpot = value(toto.power_toto_first_jackpot_prize);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Power Toto 6/55 Result",
    url: "https://www.mkt88.my" + PATH,
    description:
      "Latest Power Toto 6/55 winning numbers and jackpot prize from Sports Toto Malaysia.",
    isPartOf: { "@type": "WebSite", name: "MKT88 4D Results", url: "https://www.mkt88.my/" },
    about: {
      "@type": "Thing",
      name: "Power Toto 6/55",
      description: "Sports Toto Malaysia Power Toto 6/55 winning numbers and jackpot.",
    },
  };

  return (
    <>
      <Header />
      <RegionButtons />
      <main className="container py-4">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <h1 className="h3 mb-1">Power Toto 6/55 Result 开奖结果</h1>
        <p className="text-muted mb-4">
          Latest winning numbers and jackpot
          {toto.date ? ` · ${toto.date}` : ""}
        </p>

        <div className="border rounded p-3 p-md-4 mb-3">
          <div className="text-muted small mb-3">Winning Numbers</div>
          <div className="row g-2">
            {numbers.map((number, i) => (
              <div className="col-4 col-md-2" key={i}>
                <div className="border rounded text-center py-3 h4 mb-0">{number}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded p-3 mb-4">
          <div className="text-muted small">Power Toto 6/55 Jackpot</div>
          <div className="h4 mb-0">{jackpot}</div>
        </div>

        <h2 className="h5 mt-4">What is Power Toto 6/55?</h2>
        <p>
          Power Toto 6/55 is a Sports Toto number game in which six numbers are drawn from 1 to 55.
          The jackpot can roll over when no ticket matches all six winning numbers. This page shows the
          latest winning numbers and published jackpot amount after each draw.
        </p>

        <h2 className="h5 mt-4">See the full Sports Toto result</h2>
        <p className="mb-1">
          <a href="/result/sportstoto">Sports Toto 4D, 5D, 6D, Star Toto and Power Toto results</a>
        </p>
        <p className="mb-1">
          <a href="/number-history">Check how often your number has been drawn</a>
        </p>
        <p className="mb-0">
          <a href="/draw-schedule">Full 4D and lotto draw schedule</a>
        </p>
      </main>
      <Footer />
      <GoogleAdsense />
    </>
  );
}
