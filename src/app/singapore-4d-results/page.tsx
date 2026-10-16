import type { Metadata } from "next";
import Header from "../../components/sites/mkt88/app/Header";
import RegionButtons from "../../components/sites/mkt88/app/RegionButtons";
import SnapshotPage from "../../components/sites/mkt88/app/SnapshotPage";
import GamePager from "../../components/sites/mkt88/app/GamePager";
import Footer from "../../components/sites/mkt88/app/Footer";
import raw from "../../components/sites/mkt88/app/snapshots/singapore-4d-results.content.json";
import GoogleAdsense from "../../components/GoogleAdsense";
import SeoText from "../../components/SeoText";
import GamePastFilter from "../../components/sites/mkt88/app/GamePastFilter";
import { getPastDateLists } from "../../lib/past-dates";

export const metadata: Metadata = {
  alternates: { canonical: "/singapore-4d-results" },
  title: "Singapore Pools › singapore 4d results.",
  description: "Singapore 4D and Singapore Toto results - Live4dResult.",
};

export default async function Page() {
  const { colHtml } = raw as { colHtml: string };
  const pastDates = await getPastDateLists();
  const myDates = pastDates.my;
  return (
    <>
      <Header />
      <RegionButtons />
      <div className="d-lg-none">
        <GamePager name="sg" pastDates={pastDates} showPast />
      </div>
      <div className="d-none d-lg-block mkt-past-scope">
        <div className="container flex-shrink-0">
          <div className="row">
            <div className="col-sm-12">
              <GamePastFilter slug="sg" name="Singapore 4D" kind="my" dates={myDates} tables={pastDates.myTables} />
            </div>
          </div>
        </div>
        <SnapshotPage html={colHtml} />
      </div>
      <SeoText
        heading="Singapore Pools 4D Results 新加坡4D开彩结果"
        paragraphs={[
          "Live Singapore 4D results from Singapore Pools: 1st Prize 首奖, 2nd Prize 二奖, 3rd Prize 三奖, all 10 Starter 特别奖 and 10 Consolation 安慰奖 numbers, with the draw number and draw date.",
          "The card is checked continuously and updates within seconds of the official Singapore Pools release - every Monday, Wednesday, Saturday and Sunday draw.",
          "See the past Singapore 4D draws on the Past Results page, or check how often a number has appeared with Number History."
        ]}
        links={[
          { href: "/past-results", label: "Past Results" },
          { href: "/number-history", label: "Number History" },
          { href: "/", label: "Malaysia 4D Results" }
        ]}
      />
      <Footer />
      <GoogleAdsense />
    </>
  );
}


