import type { Metadata } from "next";
import Header from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import Footer from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";

export const metadata: Metadata = {
  title: "Contact MKT 88 4D Results",
  description:
    "How to reach the team behind MKT 88 4D Results - report a wrong or missing draw, or send a suggestion.",
  alternates: { canonical: "/contact" },
};

export default function Page() {
  return (
    <>
      <Header />
      <RegionButtons />
      <main className="container flex-shrink-0" style={{ minHeight: "60vh" }}>
        <div className="row">
          <div className="col-sm-12 mt-3 mb-4">
            <h1 className="h4 mb-3">Contact us</h1>

            <p>
              We read everything that comes in, and a report of a wrong or missing result is the
              most useful thing you can send us.
            </p>

            <h2 className="h6 mt-4">How to reach us</h2>
            <p>
              The developer contact details for the app are published on its{" "}
              <a
                href="https://play.google.com/store/apps/details?id=com.mkt88.app"
                target="_blank"
                rel="noreferrer"
              >
                Google Play store listing
              </a>
              . That is the fastest route, and it reaches the same inbox whether you use the app or
              the website.
            </p>

            <h2 className="h6 mt-4">Reporting a result that looks wrong</h2>
            <p>To let us check it quickly, please include:</p>
            <ul>
              <li>the game, for example Magnum 4D or Singapore 4D;</li>
              <li>the draw date, and the draw number if you have it;</li>
              <li>the number or prize that looks wrong;</li>
              <li>where you saw the correct result, for example the operator&rsquo;s own website.</li>
            </ul>
            <p>
              We compare every game against the operator&rsquo;s published result, so a link or a
              screenshot of the official page is usually enough for us to find the cause.
            </p>

            <h2 className="h6 mt-4">Other things worth telling us</h2>
            <ul>
              <li>A draw that is missing from the number history search.</li>
              <li>A game you would like us to add.</li>
              <li>Something in the app that does not work on your phone.</li>
            </ul>

            <h2 className="h6 mt-4">What we cannot help with</h2>
            <p>
              We are not a lottery operator and we have no access to tickets, bets or prize money.
              Claims, payouts and ticket checks have to go to the operator that issued the ticket.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
