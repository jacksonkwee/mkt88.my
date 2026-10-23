import type { Metadata } from "next";
import Header from "../../../components/sites/mkt88/app/Header";
import RegionButtons from "../../../components/sites/mkt88/app/RegionButtons";
import Footer from "../../../components/sites/mkt88/app/Footer";
import GoogleAdsense from "../../../components/GoogleAdsense";
import { getSnapshot } from "../../../lib/live-snapshot";

const PATH = "/result/magnum-4d-jackpot";

// These amounts change after every draw. Rendering this route on the server for
// each request prevents a build-time "----" page from remaining in the ISR cache.
export const dynamic = "force-dynamic";

type Card = Record<string, string>;

const money = (v?: string) => (v && v.trim() ? v.trim() : "----");
const shortDate = (date?: string) => (date || "").replace(/\s+\([A-Za-z]{3}\)\s*$/, "");

async function readMagnumJackpot() {
  const snap = await getSnapshot({ wait: true }).catch(() => null);
  const jackpot: Card = (snap?.cards?.["table-1"] || {}) as Card;
  const gold: Card = (snap?.cards?.["table-2"] || {}) as Card;
  const jp1 = money(jackpot.first_jackpot_prize);
  const jp2 = money(jackpot.second_jackpot_prize);
  const gold1 = money(gold.first_jackpot_prize);
  const gold2 = money(gold.second_jackpot_prize);
  return {
    jackpot,
    gold,
    drawDate: shortDate(gold.date || jackpot.date),
    drawNo: gold.draw_no || jackpot.draw_no || "",
    jp1,
    jp2,
    gold1,
    gold2,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const { drawDate, jp1, jp2, gold1, gold2 } = await readMagnumJackpot();
  const title = drawDate
    ? `Magnum 4D Jackpot Result ${drawDate} - Jackpot 1 & 2 Prize`
    : "Magnum 4D Jackpot Result - Jackpot 1 & 2 Prize Today";
  const amounts = [
    jp1 !== "----" ? `Jackpot 1: ${jp1}` : "",
    jp2 !== "----" ? `Jackpot 2: ${jp2}` : "",
    gold1 !== "----" ? `4D Jackpot Gold 1: ${gold1}` : "",
    gold2 !== "----" ? `4D Jackpot Gold 2: ${gold2}` : "",
  ].filter(Boolean);
  const description = (drawDate
    ? `Magnum 4D Jackpot result for ${drawDate}.`
    : "Magnum 4D Jackpot 1 and Jackpot 2 prize amounts for the latest draw.")
    + (amounts.length ? ` ${amounts.join(". ")}.` : "");
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

export default async function MagnumJackpotPage() {
  // A failed snapshot must not break the page: the headings and the explanation
  // are the part Google indexes, and the amounts fall back to "----".
  const { drawDate, drawNo, jp1, jp2, gold1, gold2 } = await readMagnumJackpot();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
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
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "When is Magnum 4D Jackpot drawn?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Magnum 4D, 4D Jackpot and 4D Jackpot Gold are usually drawn on Wednesday, Saturday and Sunday, with the draw starting at about 7:00 PM Malaysia time.",
            },
          },
          {
            "@type": "Question",
            name: "What is Magnum 4D Jackpot Gold?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "4D Jackpot Gold is a Magnum game using six digits plus a golden number, with its own Jackpot 1 and Jackpot 2 prize pools.",
            },
          },
          {
            "@type": "Question",
            name: "Why can the Magnum 4D Jackpot amounts change?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "The published prize pools can change as sales build and after a draw. They can also roll over when nobody wins, so this page uses the latest live snapshot.",
            },
          },
          {
            "@type": "Question",
            name: "Where can I find past Magnum Jackpot results?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Past draw dates are available in the MKT88 past-results archive and in the full Magnum result pages.",
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
          Saturday and Sunday. The draw schedule lists the start at about 7:00 PM Malaysia time
          (GMT+8). Results and the new jackpot amounts are published after the operator completes the
          draw.
        </p>

        <h2 className="h5 mt-4">Past Magnum Jackpot results</h2>
        <p>
          Browse the <a href="/past-results">past-results archive</a> for earlier draw dates, or open
          the <a href="/result/magnum">full Magnum result</a> for the latest 4D, Magnum Life and
          Jackpot Gold boards.
        </p>

        <h2 className="h5 mt-4">Magnum 4D Jackpot FAQ</h2>
        <h3 className="h6 mt-3">When is Magnum 4D Jackpot drawn?</h3>
        <p>
          Magnum draws are usually held on Wednesday, Saturday and Sunday, with the listed start time
          at about 7:00 PM Malaysia time.
        </p>
        <h3 className="h6 mt-3">What is Magnum 4D Jackpot Gold?</h3>
        <p>
          Jackpot Gold uses six digits plus a golden number and has its own Jackpot 1 and Jackpot 2
          prize pools.
        </p>
        <h3 className="h6 mt-3">Why can the jackpot amounts change?</h3>
        <p>
          The pools can change as sales build and after a draw. They can also roll over when nobody
          wins, so the amounts above come from the latest live snapshot.
        </p>
        <h3 className="h6 mt-3">Where can I find past Magnum Jackpot results?</h3>
        <p>
          Use the <a href="/past-results">past-results archive</a> or the
          <a href="/result/magnum"> full Magnum result page</a>.
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

        <h2 className="h5 mt-4">Other jackpot result</h2>
        <p className="mb-0">
          <a href="/result/power-toto">Power Toto 6/55 winning numbers and jackpot</a>
        </p>
      </main>
      <Footer />
      <GoogleAdsense />
    </>
  );
}
