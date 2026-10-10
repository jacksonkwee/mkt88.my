import type { Metadata } from "next";
import Header from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import Footer from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";
import SeoText from "../../components/SeoText";

export const metadata: Metadata = {
  title: "4D Draw Schedule 开彩时间表 - Draw Days & Times | mkt88.my",
  description:
    "When does each 4D game draw? Draw days and times for Magnum 4D, Da Ma Cai, Sports Toto, Singapore 4D, Sabah 88, Cash Sweep, Sandakan, Grand Dragon, Nine Lotto, Perdana and Lucky HariHari, including the Tuesday special draw dates for 2026.",
  alternates: { canonical: "https://www.mkt88.my/draw-schedule" },
};

type Row = { game: string; zh: string; days: string; daysZh: string; time: string; note?: string };

const DAILY = "Every day 每天";
const WSS = "Wed, Sat, Sun 星期三、六、日";

const SCHEDULE: Row[] = [
  { game: "Singapore 4D", zh: "新加坡", days: WSS, daysZh: "", time: "18:40", note: "The result is published shortly after the draw." },
  { game: "Grand Dragon 4D", zh: "豪龙", days: DAILY, daysZh: "", time: "19:00 – 20:10" },
  { game: "Nine Lotto 4D", zh: "九宫格", days: DAILY, daysZh: "", time: "19:00 – 20:10", note: "Usually the last of the Cambodia games to finish." },
  { game: "Perdana 4D", zh: "Perdana", days: DAILY, daysZh: "", time: "19:00 – 20:10" },
  { game: "Lucky HariHari 4D", zh: "天天好运", days: DAILY, daysZh: "", time: "19:00 – 20:10", note: "Usually the last of the Cambodia games to finish." },
  { game: "Magnum 4D", zh: "萬能", days: WSS, daysZh: "", time: "from 19:00", note: "Plus Tuesday special draws." },
  { game: "Da Ma Cai 1+3D", zh: "大馬彩", days: WSS, daysZh: "", time: "from 19:00", note: "Plus Tuesday special draws." },
  { game: "Sports Toto 4D", zh: "多多", days: WSS, daysZh: "", time: "from 19:00", note: "Plus Tuesday special draws. No draw on Monday." },
  { game: "Sabah 88 4D", zh: "沙巴88", days: WSS, daysZh: "", time: "from 19:00", note: "Plus Tuesday special draws." },
  { game: "Cash Sweep 4D", zh: "砂勞越大萬", days: WSS, daysZh: "", time: "from 19:00", note: "Plus Tuesday special draws." },
  { game: "Sandakan 4D", zh: "山打根", days: WSS, daysZh: "", time: "from 19:00", note: "Plus Tuesday special draws." },
];

const SPECIAL_2026 = ["2026-10-27", "2026-12-29"];

const pretty = (iso: string) => {
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return Number(d) + " " + months[Number(m) - 1] + " " + y;
};

export default function DrawSchedulePage() {
  return (
    <>
      <Header />
      <RegionButtons />
      <main className="container flex-shrink-0" style={{ minHeight: "60vh" }}>
        <div className="row">
          <div className="col-sm-12 mt-3 mb-4">
            <h1 className="h4 mb-3">4D Draw Schedule 开彩时间表</h1>
            <p>
              All draw times below are Malaysia time (GMT+8). Draws do not start and finish at a
              fixed moment — the numbers are released over roughly ten minutes to an hour, so the
              times shown are when the draw <em>begins</em>, not when the last number appears.
            </p>
            <p>
              以下全部是马来西亚时间（GMT+8）。开彩不是一瞬间完成的，号码会在十分钟到一小时内陆续公布，
              所以表上的时间是<strong>开彩开始</strong>的时间，不是最后一个号码出现的时间。
            </p>

            <div className="alert alert-secondary small">
              Draw days and times are set by each operator and can change. If a special draw is
              announced, the operators publish the date — we list the ones we know below.
              <br />
              开彩日期与时间由各营运商决定，可能调整。如有特别开彩，营运商会公布日期，我们会在下方列出已知的。
            </div>

            <h2 className="h5 mt-4 mb-3">Weekly schedule 每周开彩时间</h2>
            <div className="table-responsive mb-4">
              <table className="table table-sm table-striped align-middle">
                <thead>
                  <tr>
                    <th>Game 游戏</th>
                    <th>Draw days 开彩日</th>
                    <th style={{ width: 150 }}>Starts 开始</th>
                  </tr>
                </thead>
                <tbody>
                  {SCHEDULE.map((r) => (
                    <tr key={r.game}>
                      <td>
                        {r.game} <span className="text-muted">{r.zh}</span>
                        {r.note ? <div className="text-muted small">{r.note}</div> : null}
                      </td>
                      <td>{r.days}</td>
                      <td>{r.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="h5 mt-4 mb-3">Special draws 特别开彩</h2>
            <p>
              Special draws are normally held on a <strong>Tuesday</strong>, on dates the operators
              announce. There is no fixed weekly pattern and the number of special draws changes
              from year to year — usually around ten a year. Magnum 4D, Da Ma Cai, Sports Toto,
              Sabah 88, Cash Sweep and Sandakan all take part in the same special draws.
            </p>
            <p>
              特别开彩通常落在<strong>星期二</strong>，日期由营运商公布，没有固定的每周规律，每年次数也不同
              （一般约十次）。万能、大马彩、多多、沙巴88、砂勞越大萬和山打根都会参与同一场特别开彩。
            </p>
            <div className="table-responsive mb-4">
              <table className="table table-sm table-bordered align-middle">
                <thead>
                  <tr>
                    <th>Date 日期</th>
                    <th>Day 星期</th>
                    <th>Draws 参与游戏</th>
                  </tr>
                </thead>
                <tbody>
                  {SPECIAL_2026.map((iso) => (
                    <tr key={iso}>
                      <td>
                        <strong>{pretty(iso)}</strong>
                      </td>
                      <td>Tuesday 星期二</td>
                      <td>Magnum 4D, Da Ma Cai, Sports Toto, Sabah 88, Cash Sweep, Sandakan</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="h5 mt-4 mb-2">Where to see the results 去哪里看成绩</h2>
            <p>
              The <a href="/">live results page</a> updates as each draw is released, and every past
              draw is kept on the <a href="/past-results">past results</a> pages. If you want to know
              how often a number has come up, see the{" "}
              <a href="/statistics">all-time hot numbers</a>, or look up any number in{" "}
              <a href="/number-history">Number History</a>, which goes back to 1985.
            </p>
          </div>
        </div>
      </main>
      <SeoText
        heading="4D 开彩时间表 - 每天几点开奖"
        paragraphs={[
          "这一页列出马來西亚与新加坡 11 个万字游戏的开彩日与开彩时间：新加坡 4D 星期三、六、日 18:40；豪龙、九宫格、Perdana 和天天好运每天 19:00 至 20:10 开彩，其中九宫格与天天好运通常最迟结束；万能、大马彩、多多、沙巴88、砂勞越大萬和山打根在星期三、六、日晚上 19:00 开始，另有星期二特别开彩。",
          "All times are Malaysia time. Special draw dates are announced by the operators; the 2026 dates we have confirmed are listed on this page.",
        ]}
        links={[
          { href: "/", label: "Live 4D Results 最新开奖" },
          { href: "/statistics", label: "Hot Numbers 热门号码" },
          { href: "/number-history", label: "Number History 开彩记录" },
          { href: "/past-results", label: "Past Results 过去开彩" },
        ]}
      />
      <Footer />
    </>
  );
}