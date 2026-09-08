import type { Metadata } from "next";
import Header from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import Footer from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy - 恭喜发财 4D",
  description: "Privacy Policy for the 4D results website.",
};

export default function Page() {
  return (
    <>
      <Header />
      <RegionButtons />
      <main className="container flex-shrink-0" style={{ minHeight: "60vh" }}>
        <div className="row">
          <div className="col-sm-12 mt-3 mb-4">
            <h1 className="h4 mb-3">Privacy Policy</h1>
                        <p>This website (恭喜发财 4D) displays 4D lottery draw results for information purposes only. We do not operate, sell, or endorse any lottery or betting product.</p>
            <h2 className="h6 mt-4">What we collect</h2>
            <p>We do not collect personal information. Our pages only load publicly available draw results. Advertising partners (when ads are enabled) may use cookies to serve personalised ads. Google AdSense and similar networks may collect anonymous usage data as described in their own privacy policies.</p>
            <h2 className="h6 mt-4">Cookies</h2>
            <p>We use no cookies of our own. Third-party advertising providers may set cookies to measure ad performance. You can opt out via Google&rsquo;s Ads Settings.</p>
            <h2 className="h6 mt-4">Contact</h2>
            <p>If you have questions about this policy, please contact the site operator.</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
