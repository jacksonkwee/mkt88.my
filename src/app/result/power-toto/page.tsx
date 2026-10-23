import type { Metadata } from "next";
import Header from "../../../components/sites/mkt88/app/Header";
import RegionButtons from "../../../components/sites/mkt88/app/RegionButtons";
import Footer from "../../../components/sites/mkt88/app/Footer";
import GoogleAdsense from "../../../components/GoogleAdsense";
import { getSnapshot } from "../../../lib/live-snapshot";

const PATH = "/result/power-toto";

export const dynamic = "force-dynamic";

type Card = Record<string, string>;

const dash = (v?: string) => !v || /^----+$/.test(v.trim());
const value = (v?: string) => (dash(v) ? "----" : v!.trim());
const shortDate = (date?: string) => (date || "").replace(/\s+\([A-Za-z]{3}\)\s*$/, "");

async function readPowerToto() {
  const snap = await getSnapshot({ wait: true }).catch(() => null);
  const toto: Card = (snap?.cards?.["table-7"] || {}) as Card;
  const numbers = Array.from({ length: 6 }, (_, i) => value(toto["power_toto_number_" + (i + 1)]));
  const jackpot = value(toto.power_toto_first_jackpot_prize);
  return { toto, numbers, jackpot };
}

export async function generateMetadata(): Promise<Metadata> {
  const { toto, numbers, jackpot } = await readPowerToto();
  const date = shortDate(toto.date);
  const title = date
    ? `Power Toto 6/55 Result ${date} - Winning Numbers & Jackpot`
    : "Power Toto 6/55 Result Today - Winning Numbers & Jackpot Prize";
  const numberLine = numbers.every((number) => !dash(number))
    ? ` Winning numbers: ${numbers.join(", ")}.`
    : "";
  const description = (date
    ? `Power Toto 6/55 result for ${date}.${numberLine}`
    : "Latest Power Toto 6/55 winning numbers and jackpot prize from Sports Toto Malaysia.")
    + (!dash(jackpot) ? ` Jackpot: ${jackpot}.` : "");
  return {
    title,
    description,
    alternates: { canonical: PATH },
    openGraph: {
      title,
      description,
      url: "https://www.mkt88.my" + PATH,
      type: "website",
    },
  };
}

export default async function PowerTotoPage() {
  const { toto, numbers, jackpot } = await readPowerToto();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
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
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "When is Power Toto 6/55 drawn?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Sports Toto's regular draw schedule is Wednesday, Saturday and Sunday, with Tuesday special draws when announced. Draws are listed at about 7:00 PM Malaysia time.",
            },
          },
          {
            "@type": "Question",
            name: "How many numbers are drawn for Power Toto 6/55?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Six numbers are drawn from 1 to 55.",
            },
          },
          {
            "@type": "Question",
            name: "Why can the Power Toto jackpot amount change?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "The published jackpot can change as sales build and as the prize is updated or rolled over after a draw. This page shows the latest amount supplied by the live snapshot.",
            },
          },
          {
            "@type": "Question",
            name: "Where can I find past Power Toto results?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Past draw dates are available in the MKT88 past-results archive and in the full Sports Toto result pages.",
            },
          },
        ],
      },
    ],
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

        <h2 className="h5 mt-4">Power Toto 6/55 draw time</h2>
        <p>
          Sports Toto&apos;s regular draws are held on Wednesday, Saturday and Sunday, with Tuesday
          special draws when announced. The schedule lists the draw as starting at about 7:00 PM
          Malaysia time (GMT+8). Numbers and the jackpot can take a little longer to appear while the
          operator publishes the completed draw.
        </p>

        <h2 className="h5 mt-4">Past Power Toto results</h2>
        <p>
          Browse the <a href="/past-results">past-results archive</a> for earlier draw dates, or open
          the <a href="/result/sportstoto">full Sports Toto result</a> for the latest 4D, 5D, 6D, Star
          Toto and Power Toto boards.
        </p>

        <h2 className="h5 mt-4">Power Toto 6/55 FAQ</h2>
        <h3 className="h6 mt-3">When is Power Toto 6/55 drawn?</h3>
        <p>
          Regular draws are on Wednesday, Saturday and Sunday, with Tuesday special draws when
          announced. The listed start time is about 7:00 PM Malaysia time.
        </p>
        <h3 className="h6 mt-3">How many numbers are drawn for Power Toto 6/55?</h3>
        <p>Six numbers are drawn from 1 to 55.</p>
        <h3 className="h6 mt-3">Why can the Power Toto jackpot amount change?</h3>
        <p>
          The published jackpot can change as sales build and after the prize is updated or rolled
          over. The amount above comes from the latest live snapshot.
        </p>
        <h3 className="h6 mt-3">Where can I find past Power Toto results?</h3>
        <p>
          Use the <a href="/past-results">past-results archive</a> or the
          <a href="/result/sportstoto"> full Sports Toto page</a>.
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

        <h2 className="h5 mt-4">Other jackpot result</h2>
        <p className="mb-0">
          <a href="/result/magnum-4d-jackpot">Magnum 4D Jackpot 1, Jackpot 2 and Jackpot Gold</a>
        </p>
      </main>
      <Footer />
      <GoogleAdsense />
    </>
  );
}
