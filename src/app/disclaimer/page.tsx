import type { Metadata } from "next";
import Header from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import Footer from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";

export const metadata: Metadata = {
  title: "Disclaimer - 恭喜发财 4D",
  description: "Disclaimer for the 4D results website.",
};

export default function Page() {
  return (
    <>
      <Header />
      <RegionButtons />
      <main className="container flex-shrink-0" style={{ minHeight: "60vh" }}>
        <div className="row">
          <div className="col-sm-12 mt-3 mb-4">
            <h1 className="h4 mb-3">Disclaimer</h1>
                        <p>The draw results shown on this website are provided for information only. We source results from official lottery operators and public result feeds, but we do not guarantee accuracy, completeness, or timeliness.</p>
            <h2 className="h6 mt-4">No gambling advice</h2>
            <p>Nothing on this website is gambling advice or an invitation to gamble. We do not accept bets and we are not affiliated with any lottery operator.</p>
            <h2 className="h6 mt-4">Gamble responsibly</h2>
            <p>If you choose to play any lottery or 4D game, do so legally and responsibly, and only if it is permitted in your country. Please play for entertainment and within your means.</p>
            <h2 className="h6 mt-4">Liability</h2>
            <p>We are not liable for any loss arising from reliance on the information published on this website. Always verify results with the official operator.</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
