import type { Metadata } from "next";
import Header from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Header";
import RegionButtons from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/RegionButtons";
import Footer from "../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/Footer";
import SeoText from "../../components/SeoText";
import stats from "../../lib/number-stats.json";

export const metadata: Metadata = {
  title: "All-Time 4D Hot Numbers 万字热门号码统计 | mkt88.my",
  description:
    "Which 4D numbers come up most often? Hot number statistics for Magnum 4D, Da Ma Cai, Sports Toto, Singapore 4D, Sabah 88, Cash Sweep, Sandakan, Grand Dragon, Nine Lotto, Perdana and Lucky HariHari, counted from every draw in our archive.",
  alternates: { canonical: "https://www.mkt88.my/statistics" },
};

type Game = (typeof stats.games)[number];

const n = (v: number) => v.toLocaleString("en-US");
const dmy = (iso: string | null) => {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return d + "/" + m + "/" + y;
};

export default function StatisticsPage() {
  const games = stats.games as Game[];
  const draws = games.reduce((s, g) => s + g.draws, 0);
  const appearances = games.reduce((s, g) => s + g.totalAppearances, 0);
  const latest = games.map((g) => g.to).filter(Boolean).sort().slice(-1)[0];

  return (
    <>
      <Header />
      <RegionButtons />
      <main className="container flex-shrink-0" style={{ minHeight: "60vh" }}>
        <div className="row">
          <div className="col-sm-12 mt-3 mb-4">
            <h1 className="h4 mb-3">All-Time 4D Hot Numbers 万字热门号码统计</h1>

            <p>
              This page ranks the numbers that have come up most often in each 4D game, counted
              across every draw in <strong>our archive</strong> — <strong>{n(draws)}</strong> draws
              and <strong>{n(appearances)}</strong> winning-number records across all 11 games,
              copied up to <strong>{dmy(latest)}</strong>.
            </p>
            <p>
              这一页列出每个万字游戏里<strong>出现次数最多</strong>的号码，是根据我们档案里的每一次开彩记录统计出来的
              —— 共 <strong>{n(draws)}</strong> 次开彩、<strong>{n(appearances)}</strong> 个中奖号码记录，
              涵盖全部 11 个游戏，资料抄录至 <strong>{dmy(latest)}</strong>。
            </p>

            <div className="alert alert-secondary small">
              <strong>These are historical counts, not predictions.</strong> Every draw is independent:
              how often a number has appeared in the past does not change its chance in the next draw.
              This page is for information and curiosity only.
              <br />
              <strong>这些是历史次数，不是预测。</strong>每一次开彩都是独立的 ——
              号码过去出现多少次，都不会改变它下一次的机会。本页仅供参考。
            </div>

            <h2 className="h5 mt-4 mb-3">Coverage 数据范围</h2>
            <p className="text-muted small">
              The dates below describe <strong>our archive</strong>, not necessarily every draw a game
              has ever held. Grand Dragon&rsquo;s archive starts 12/06/2020 &mdash; the earliest draw its
              operator still publishes; the 2017&ndash;2019 draws are no longer available from them.
              <br />
              下表日期描述的是<strong>我们的档案</strong>，不一定等于该游戏的全部历史。
              豪龙（Grand Dragon）的档案从 12/06/2020 开始 —— 这是营运商目前仍然提供的最早成绩；
              2017–2019 年的成绩，营运商已经不再提供。
            </p>
            <div className="table-responsive mb-4">
              <table className="table table-sm table-striped align-middle">
                <thead>
                  <tr>
                    <th>Game 游戏</th>
                    <th className="text-end">Draws in archive 档案开彩次数</th>
                    <th className="text-end">Number records 号码记录</th>
                    <th>Archive starts 档案最早</th>
                    <th>Archive ends 档案最近</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((g) => (
                    <tr key={g.key}>
                      <td>
                        {g.name} <span className="text-muted">{g.zh}</span>
                      </td>
                      <td className="text-end">{n(g.draws)}</td>
                      <td className="text-end">{n(g.totalAppearances)}</td>
                      <td>{dmy(g.from)}</td>
                      <td>{dmy(g.to)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="h5 mt-4 mb-2">Hot numbers by game 各游戏热门号码</h2>
            <p className="text-muted small">
              &ldquo;Times drawn&rdquo; counts every prize position a number appeared in — 1st, 2nd, 3rd,
              Special or Consolation. &ldquo;As 1st prize&rdquo; counts only the top prize.
              <br />
              「出现次数」包括头奖、二奖、三奖、特别奖和安慰奖；「头奖次数」只算第一名。
            </p>

            <div className="row">
              {games.map((g) => (
                <div className="col-lg-6" key={g.key}>
                  <h3 className="h6 mt-4 mb-2">
                    {g.name} <span className="text-muted">{g.zh}</span>
                  </h3>
                  <div className="text-muted small mb-2">
                    {dmy(g.from)} &ndash; {dmy(g.to)} &middot; {n(g.draws)} draws in archive
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered align-middle mb-4">
                      <thead>
                        <tr>
                          <th style={{ width: 42 }}>#</th>
                          <th>Number 号码</th>
                          <th className="text-end">Times drawn</th>
                          <th className="text-end">As 1st prize</th>
                          <th>Last seen 最近一次</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.hot.slice(0, 10).map((h, i) => (
                          <tr key={h.num}>
                            <td>{i + 1}</td>
                            <td>
                              <a href={"/number-history?num=" + h.num}>
                                <strong>{h.num}</strong>
                              </a>
                            </td>
                            <td className="text-end">{h.count}</td>
                            <td className="text-end">{h.first}</td>
                            <td>{dmy(h.last)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            <h2 className="h5 mt-4 mb-2">How to read this 怎么看</h2>
            <p>
              A 4D draw produces 23 winning numbers (three top prizes, ten Special and ten
              Consolation), so a perfectly even game would see each of the 10,000 numbers appear
              roughly once every 435 draws. Numbers well above that line are simply the ones that
              have been drawn most often so far.
            </p>
            <p>
              Click any number to open it in <a href="/number-history">Number History 开彩记录</a>,
              where you can see every single draw it appeared in — the exact date, game and prize —
              and check other numbers, their permutations (Pau 包) or their reverse (来回). Draw days
              and times for every game are on the <a href="/draw-schedule">draw schedule</a>.
            </p>
          </div>
        </div>
      </main>
      <SeoText
        heading="4D Hot Numbers 万字热门号码 - 历史统计"
        paragraphs={[
          "本页统计 11 个万字游戏的开彩记录，列出每个游戏出现次数最多的号码，并标明它作为头奖出现的次数以及最近一次出现的日期。统计只根据我们档案里已有的记录计算，资料仍在持续补齐。",
          "Use the all-time hot number list alongside the Number History search: the list shows which numbers come up most often, and Number History shows exactly when and where each one appeared.",
        ]}
        links={[
          { href: "/number-history", label: "Number History 开彩记录" },
          { href: "/draw-schedule", label: "Draw Schedule 开彩时间表" },
          { href: "/", label: "Live 4D Results 最新开奖" },
          { href: "/past-results", label: "Past Results 过去开彩" },
          { href: "/favourites", label: "Favourite Numbers 收藏号码" },
        ]}
      />
      <Footer />
    </>
  );
}