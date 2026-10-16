import type { Metadata } from "next";
import Header from "../../components/sites/mkt88/app/Header";
import RegionButtons from "../../components/sites/mkt88/app/RegionButtons";
import Footer from "../../components/sites/mkt88/app/Footer";

export const metadata: Metadata = {
  title: "Terms of Use - MKT 88 4D Results",
  description: "The terms that apply when you use the MKT 88 4D Results website and app.",
  alternates: { canonical: "/terms" },
};

export default function Page() {
  return (
    <>
      <Header />
      <RegionButtons />
      <main className="container flex-shrink-0" style={{ minHeight: "60vh" }}>
        <div className="row">
          <div className="col-sm-12 mt-3 mb-4">
            <h1 className="h4 mb-3">Terms of Use</h1>
            <p className="text-muted" style={{ fontSize: 14 }}>
              By using this website or the MKT 88 app you agree to these terms.
            </p>

            <h2 className="h6 mt-4">1. Information only</h2>
            <p>
              The draw results, number history and any other information published here are
              provided for general information. They are not betting advice, and nothing on this
              site is an invitation or encouragement to gamble.
            </p>

            <h2 className="h6 mt-4">2. Accuracy</h2>
            <p>
              We take care to collect results from the operators&rsquo; own published sources and
              to cross-check them, but we cannot guarantee that every figure is accurate, complete
              or up to date at the moment you read it. Always confirm a result with the official
              operator before acting on it, and treat the operator&rsquo;s published result as
              final.
            </p>

            <h2 className="h6 mt-4">3. No operator relationship</h2>
            <p>
              This site is independent and is not affiliated with, endorsed by or connected to any
              lottery operator. We do not sell tickets, accept bets, hold stakes or pay winnings,
              and we cannot check, claim or transfer a prize.
            </p>

            <h2 className="h6 mt-4">4. Acceptable use</h2>
            <p>
              Please do not attempt to disrupt the site, scrape it in a way that degrades service
              for others, or use it for anything unlawful. Content, layout and the compiled draw
              history remain the property of their respective owners and may not be republished
              commercially without permission.
            </p>

            <h2 className="h6 mt-4">5. Limits of liability</h2>
            <p>
              To the extent permitted by law, we are not liable for any loss or damage arising from
              use of, or reliance on, this site or the app, including decisions made on the basis
              of a result shown here.
            </p>

            <h2 className="h6 mt-4">6. Availability and changes</h2>
            <p>
              The service is provided free of charge and may change, be interrupted or be withdrawn
              at any time. We may update these terms; the version published on this page is the one
              that applies.
            </p>

            <h2 className="h6 mt-4">7. Play responsibly</h2>
            <p>
              Only take part in a lottery or 4D game if it is legal where you are, and only for
              entertainment and within your means. Never bet money you cannot afford to lose.
            </p>

            <p className="mt-4">
              See also our <a href="/disclaimer">Disclaimer</a> and{" "}
              <a href="/privacy-policy">Privacy Policy</a>, or <a href="/contact">contact us</a>.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
