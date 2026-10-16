import type { Metadata } from "next";
import type { ReactNode } from "react";
import AppTopBar from "../../components/AppTopBar";
import Footer from "../../components/sites/mkt88/app/Footer";
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

/**
 * One label in three languages.
 *
 * The page is built once and served as static HTML, so all three languages sit
 * in the markup and globals.css shows only the one the reader chose - keyed on
 * data-lang, which the language setting writes onto <html>. That keeps the page
 * static and fast while still switching instantly.
 */
function L({ en, ms, zh }: { en: ReactNode; ms: ReactNode; zh: ReactNode }) {
  return (
    <>
      <span className="L-en">{en}</span>
      <span className="L-ms">{ms}</span>
      <span className="L-zh">{zh}</span>
    </>
  );
}

export default function StatisticsPage() {
  const games = stats.games as Game[];
  const draws = games.reduce((s, g) => s + g.draws, 0);
  const appearances = games.reduce((s, g) => s + g.totalAppearances, 0);
  const latest = games.map((g) => g.to).filter(Boolean).sort().slice(-1)[0];

  return (
    <>
      <AppTopBar titleKey="hot" />
      <main className="container flex-shrink-0" style={{ minHeight: "60vh" }}>
        <div className="row">
          <div className="col-sm-12 mt-3 mb-4">
            <h1 className="h4 mb-3">
              <L en="All-Time 4D Hot Numbers" ms="Nombor Panas 4D Sepanjang Masa" zh="万字热门号码统计" />
            </h1>

            <div className="alert alert-secondary small">
              <strong>
                <L en="These are historical counts, not predictions." ms="Ini kiraan sejarah, bukan ramalan." zh="这些是历史次数，不是预测。" />
              </strong>
              <L
                en=" Every draw is independent: how often a number has appeared in the past does not change its chance in the next draw. This page is for information and curiosity only."
                ms=" Setiap cabutan adalah bebas: berapa kerap sesuatu nombor muncul sebelum ini tidak mengubah peluangnya pada cabutan seterusnya. Halaman ini untuk maklumat sahaja."
                zh=" 每一次开彩都是独立的 —— 号码过去出现多少次，都不会改变它下一次的机会。本页仅供参考。"
              />
            </div>

            <h2 className="h5 mt-4 mb-2">
              <L en="Hot numbers by game" ms="Nombor panas mengikut permainan" zh="各游戏热门号码" />
            </h2>
            <p className="text-muted small">
              <L
                en={'"Times drawn" counts every prize position a number appeared in — 1st, 2nd, 3rd, Special or Consolation. "As 1st prize" counts only the top prize.'}
                ms={'"Kali dikeluarkan" mengira setiap kedudukan hadiah yang nombor itu muncul — hadiah pertama, kedua, ketiga, Istimewa atau Saguhati. "Sebagai hadiah pertama" hanya mengira hadiah utama.'}
                zh="「出现次数」包括头奖、二奖、三奖、特别奖和安慰奖；「首奖记录」只算第一名。"
              />
            </p>

            <div className="row">
              {games.map((g) => (
                <div className="col-lg-6" key={g.key}>
                  <h3 className="h6 mt-4 mb-2">
                    <L en={g.name} ms={g.name} zh={g.zh || g.name} />
                  </h3>
                  <div className="text-muted small mb-2">
                    {dmy(g.from)} &ndash; {dmy(g.to)} &middot;{" "}
                    <L en={n(g.draws) + " draws"} ms={n(g.draws) + " cabutan"} zh={n(g.draws) + " 次开彩"} />
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered align-middle mb-4">
                      <thead>
                        <tr>
                          <th style={{ width: 42 }}>#</th>
                          <th>
                            <L en="Number" ms="Nombor" zh="号码" />
                          </th>
                          <th className="text-end">
                            <L en="Times drawn" ms="Kali dikeluarkan" zh="开彩次数" />
                          </th>
                          <th className="text-end">
                            <L en="As 1st prize" ms="Sebagai hadiah pertama" zh="首奖记录" />
                          </th>
                          <th>
                            <L en="Last seen" ms="Kali terakhir" zh="最近一次" />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.hot.slice(0, 10).map((h, i) => (
                          <tr key={h.num}>
                            <td>{i + 1}</td>
                            <td className="mkt-hot-cell">
                              <a className="mkt-hot-num" href={"/number-history?num=" + h.num}>
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

            <h2 className="h5 mt-4 mb-2">
              <L en="Coverage" ms="Liputan" zh="数据范围" />
            </h2>
            <p className="text-muted small mb-2">
              <L
                en={<>Draws copied up to <strong>{dmy(latest)}</strong> &middot; statistics rebuilt <strong>{dmy(stats.generated)}</strong>. Both move on their own, every night.</>}
                ms={<>Cabutan disalin sehingga <strong>{dmy(latest)}</strong> &middot; statistik dibina semula <strong>{dmy(stats.generated)}</strong>. Kedua-duanya berubah sendiri setiap malam.</>}
                zh={<>资料抄录至 <strong>{dmy(latest)}</strong>，统计于 <strong>{dmy(stats.generated)}</strong> 重建。两个日期每晚自动更新。</>}
              />
            </p>
            <div className="table-responsive mb-4">
              <table className="table table-sm table-striped align-middle">
                <thead>
                  <tr>
                    <th>
                      <L en="Game" ms="Permainan" zh="游戏" />
                    </th>
                    <th className="text-end">
                      <L en="Draws in archive" ms="Cabutan dalam arkib" zh="档案开彩次数" />
                    </th>
                    <th className="text-end">
                      <L en="Number records" ms="Rekod nombor" zh="号码记录" />
                    </th>
                    <th>
                      <L en="Archive starts" ms="Arkib bermula" zh="档案最早" />
                    </th>
                    <th>
                      <L en="Archive ends" ms="Arkib berakhir" zh="档案最近" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((g) => (
                    <tr key={g.key}>
                      <td>
                        <L en={g.name} ms={g.name} zh={g.zh || g.name} />
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

            <p>
              <L
                en={<>This page ranks the numbers that have come up most often in each 4D game, counted across every draw in <strong>our archive</strong> — <strong>{n(draws)}</strong> draws and <strong>{n(appearances)}</strong> winning-number records across all 11 games, copied up to <strong>{dmy(latest)}</strong>.</>}
                ms={<>Halaman ini menyusun nombor yang paling kerap muncul dalam setiap permainan 4D, dikira daripada setiap cabutan dalam <strong>arkib kami</strong> — <strong>{n(draws)}</strong> cabutan dan <strong>{n(appearances)}</strong> rekod nombor menang bagi kesemua 11 permainan, disalin sehingga <strong>{dmy(latest)}</strong>.</>}
                zh={<>这一页列出每个万字游戏里<strong>出现次数最多</strong>的号码，是根据我们档案里的每一次开彩记录统计出来的 —— 共 <strong>{n(draws)}</strong> 次开彩、<strong>{n(appearances)}</strong> 个中奖号码记录，涵盖全部 11 个游戏，资料抄录至 <strong>{dmy(latest)}</strong>。</>}
              />
            </p>

            <h2 className="h5 mt-4 mb-2">
              <L en="How to read this" ms="Cara membacanya" zh="怎么看" />
            </h2>
            <p>
              <L
                en="A 4D draw produces 23 winning numbers (three top prizes, ten Special and ten Consolation), so a perfectly even game would see each of the 10,000 numbers appear roughly once every 435 draws. Numbers well above that line are simply the ones that have been drawn most often so far."
                ms="Satu cabutan 4D menghasilkan 23 nombor menang (tiga hadiah utama, sepuluh Istimewa dan sepuluh Saguhati), jadi permainan yang benar-benar sekata akan melihat setiap daripada 10,000 nombor muncul lebih kurang sekali setiap 435 cabutan. Nombor yang jauh melebihi garis itu hanyalah nombor yang paling kerap dicabut setakat ini."
                zh="一次 4D 开彩会产生 23 个中奖号码（三个主要奖、十个特别奖、十个安慰奖），所以完全平均的话，一万个号码大约每 435 次开彩会出现一次。明显高出这条线的，就是到目前为止最常开出的号码。"
              />
            </p>
            <p>
              <L
                en={<>Click any number to open it in <a href="/number-history">Number History</a>, where you can see every single draw it appeared in — the exact date, game and prize — and check other numbers, their permutations (Pau) or their reverse. Draw days and times for every game are on the <a href="/draw-schedule">draw schedule</a>.</>}
                ms={<>Klik mana-mana nombor untuk membukanya dalam <a href="/number-history">Sejarah Nombor</a>, di mana anda boleh lihat setiap cabutan ia muncul — tarikh, permainan dan hadiah yang tepat — serta menyemak nombor lain, pilihannya (Pau) atau sonsangannya. Hari dan masa cabutan setiap permainan ada di <a href="/draw-schedule">jadual cabutan</a>.</>}
                zh={<>点任何一个号码，就会在<a href="/number-history">开彩记录</a>里打开它 —— 看到它出现过的每一次开彩（确切日期、游戏、奖项），也可以查其他号码、它的排列（Pau 包）或来回。每个游戏的开彩日与时间在<a href="/draw-schedule">开彩时间表</a>。</>}
              />
            </p>
            <p className="text-muted small">
              <L
                en="The dates above describe our archive, not necessarily every draw a game has ever held. Grand Dragon's archive starts 12/06/2020 — the earliest draw its operator still publishes; the 2017-2019 draws are no longer available from them."
                ms="Tarikh di atas menggambarkan arkib kami, bukan semestinya setiap cabutan yang pernah diadakan. Arkib Grand Dragon bermula 12/06/2020 — cabutan terawal yang masih diterbitkan oleh pengendalinya; cabutan 2017-2019 tidak lagi tersedia daripada mereka."
                zh="上表日期描述的是我们的档案，不一定等于该游戏的全部历史。豪龙（Grand Dragon）的档案从 12/06/2020 开始 —— 这是营运商目前仍然提供的最早成绩；2017–2019 年的成绩，营运商已经不再提供。"
              />
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
