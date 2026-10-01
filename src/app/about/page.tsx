import type { Metadata } from "next";
import Header from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import Footer from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";

export const metadata: Metadata = {
  title: "About MKT 88 4D Results",
  description:
    "What this site is, which 4D games it covers, how far back the draw history goes, and how the results are checked.",
  alternates: { canonical: "/about" },
};

const GAMES = [
  ["Magnum 4D", "since 1985"],
  ["Da Ma Cai 1+3D", "since 1992"],
  ["Sports Toto 4D", "since 1992"],
  ["Sandakan 4D", "since 1995"],
  ["Cash Sweep 4D", "since 1996"],
  ["Sabah 88 4D", "since 2001"],
  ["Singapore 4D", "since 2007"],
  ["Perdana 4D", "since 2021"],
  ["Lucky HariHari", "since 2021"],
  ["Grand Dragon 4D", "since 2022"],
  ["Nine Lotto", "since 2023"],
];

export default function Page() {
  return (
    <>
      <Header />
      <RegionButtons />
      <main className="container flex-shrink-0" style={{ minHeight: "60vh" }}>
        <div className="row">
          <div className="col-sm-12 mt-3 mb-4">
            <h1 className="h4 mb-3">About MKT 88 4D Results</h1>

            <p>
              MKT 88 is a free 4D results website and Android app covering eleven lottery games in
              Malaysia, Singapore and Cambodia. There is no account to create and nothing to pay -
              the results are simply there when you open the page.
            </p>

            <h2 className="h6 mt-4">What you can do here</h2>
            <p>
              See the latest draw for every game, look up any past draw by date, and search a
              four-digit number to see every draw in which it has ever appeared. You can also
              save numbers as favourites to find them again quickly.
            </p>

            <h2 className="h6 mt-4">The eleven games we cover</h2>
            <p>
              The draw history held here reaches back much further than a results site usually
              does, because it was rebuilt from the operators&rsquo; own archives rather than
              copied from another results page:
            </p>
            <ul>
              {GAMES.map(([name, since]) => (
                <li key={name}>
                  <strong>{name}</strong> - {since}
                </li>
              ))}
            </ul>
            <p>
              That covers well over a million individual prize entries, and the list keeps
              growing: new draws are added the same day they are published.
            </p>

            <h2 className="h6 mt-4">How the results are collected and checked</h2>
            <p>
              Numbers are read from the lottery operators&rsquo; own published results and from
              their official result feeds - for example Singapore Pools for Singapore 4D, the
              Perdana and HariHari operator APIs for those games, and 9lotto for Nine Lotto.
            </p>
            <p>
              Because result feeds can arrive late or, occasionally, carry a number belonging to
              the wrong draw, we do not trust a single source on its own. Every game is
              cross-checked against an independent source, and a card is only shown once the
              sources agree on the same draw date. If a feed lags behind, the page holds the last
              complete draw rather than showing half of a new one.
            </p>

            <h2 className="h6 mt-4">What we are not</h2>
            <p>
              This site is independent. It is not operated by, endorsed by, or connected to Magnum,
              Da Ma Cai, Sports Toto, Singapore Pools or any other lottery operator. We do not sell
              tickets, accept bets, hold money, or pay out winnings. Results are published for
              information only - always confirm a winning ticket with the operator before relying
              on it.
            </p>

            <h2 className="h6 mt-4">The app</h2>
            <p>
              The Android app adds a keep-screen-on setting and the same draw history, and it is
              free. Questions or corrections are welcome on our <a href="/contact">contact page</a>.
            </p>
            <p>
              <a href="https://play.google.com/store/apps/details?id=com.mkt88.app" target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/sites/live4dresult-net-0600c55d/root-8a5edab2/google-play-badge.png"
                  alt="Get it on Google Play"
                  style={{ width: 200, marginLeft: -10 }}
                />
              </a>
              <a
                href="https://www.facebook.com/mkt88my"
                target="_blank"
                rel="noreferrer"
                aria-label="Follow MKT 88 4D on Facebook"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: 18, textDecoration: "none" }}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#1877F2"
                    d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                  />
                </svg>
                <span style={{ fontSize: 15 }}>Follow us on Facebook</span>
              </a>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
