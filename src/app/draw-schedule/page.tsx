import type { Metadata } from "next";
import type { ReactNode } from "react";
import Header from "../../components/sites/mkt88/app/Header";
import RegionButtons from "../../components/sites/mkt88/app/RegionButtons";
import Footer from "../../components/sites/mkt88/app/Footer";
import { getSpecialDrawDates } from "../../lib/special-draws";

export const metadata: Metadata = {
  title: "4D Draw Schedule 开彩时间表 - Draw Days & Times | mkt88.my",
  description:
    "When does each 4D game draw? Draw days and times for Magnum 4D, Da Ma Cai, Sports Toto, Singapore 4D, Sabah 88, Cash Sweep, Sandakan, Grand Dragon, Nine Lotto, Perdana and Lucky HariHari, including the Tuesday special draw dates for 2026.",
  alternates: { canonical: "https://www.mkt88.my/draw-schedule" },
};

/**
 * One label in three languages.
 *
 * The page is built once and served as static HTML, so all three languages sit
 * in the markup and globals.css shows only the one the reader chose - keyed on
 * data-lang, which the language setting writes onto <html>. Static means fast.
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

type Tri = { en: string; ms: string; zh: string };
type Row = { game: string; zh: string; days: Tri; time: string; note?: Tri };

const WSS: Tri = { en: "Wed, Sat, Sun", ms: "Rab, Sab, Ahd", zh: "星期三、六、日" };
const DAILY: Tri = { en: "Every day", ms: "Setiap hari", zh: "每天" };
const TUE: Tri = { en: "Plus Tuesday special draws.", ms: "Termasuk cabutan khas Selasa.", zh: "另加星期二特别开彩。" };
const LAST: Tri = { en: "Usually the last of the Cambodia games to finish.", ms: "Biasanya yang terakhir tamat antara permainan Kemboja.", zh: "通常是柬埔寨游戏里最迟结束的。" };
const NO_MON: Tri = { en: "No draw on Monday.", ms: "Tiada cabutan pada Isnin.", zh: "星期一不开彩。" };

const SCHEDULE: Row[] = [
  { game: "Singapore 4D", zh: "新加坡", days: WSS, time: "18:30", note: { en: "The result is published shortly after the draw.", ms: "Keputusan diterbitkan tidak lama selepas cabutan.", zh: "开彩结束后不久就会公布成绩。" } },
  { game: "Grand Dragon 4D", zh: "豪龙", days: DAILY, time: "19:00 – 20:10" },
  { game: "Nine Lotto 4D", zh: "九彩票", days: DAILY, time: "19:00 – 20:10", note: LAST },
  { game: "Perdana 4D", zh: "Perdana", days: DAILY, time: "19:00 – 20:10" },
  { game: "Lucky HariHari 4D", zh: "天天好运", days: DAILY, time: "19:00 – 20:10", note: LAST },
  { game: "Magnum 4D", zh: "万能", days: WSS, time: "19:00", note: TUE },
  { game: "Da Ma Cai 1+3D", zh: "大马彩", days: WSS, time: "19:00", note: TUE },
  { game: "Sports Toto 4D", zh: "多多", days: WSS, time: "19:00", note: { en: "Plus Tuesday special draws. No draw on Monday.", ms: "Termasuk cabutan khas Selasa. Tiada cabutan pada Isnin.", zh: "另加星期二特别开彩；星期一不开彩。" } },
  { game: "Sabah 88 4D", zh: "沙巴88", days: WSS, time: "19:00", note: TUE },
  { game: "Cash Sweep 4D", zh: "砂拉越大万", days: WSS, time: "19:00", note: TUE },
  { game: "Sandakan 4D", zh: "山打根", days: WSS, time: "19:00", note: TUE },
];

const SPECIAL_GAMES = "Magnum 4D, Da Ma Cai, Sports Toto, Sabah 88, Cash Sweep, Sandakan";

const pretty = (iso: string) => {
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return Number(d) + " " + months[Number(m) - 1] + " " + y;
};

/** The weekday of a special draw, which is not always a Tuesday. */
const DAY_NAMES = [
  { en: "Sunday", ms: "Ahad", zh: "星期日" },
  { en: "Monday", ms: "Isnin", zh: "星期一" },
  { en: "Tuesday", ms: "Selasa", zh: "星期二" },
  { en: "Wednesday", ms: "Rabu", zh: "星期三" },
  { en: "Thursday", ms: "Khamis", zh: "星期四" },
  { en: "Friday", ms: "Jumaat", zh: "星期五" },
  { en: "Saturday", ms: "Sabtu", zh: "星期六" },
];
const dayName = (iso: string) => DAY_NAMES[new Date(iso + "T12:00:00").getDay()] || DAY_NAMES[2];

export default async function DrawSchedulePage() {
  // The dates the owner keeps in /admin, so a new special draw is listed here
  // as soon as it is saved.
  const specialDates = await getSpecialDrawDates();
  return (
    <>
      <Header />
      <RegionButtons />
      <main className="container flex-shrink-0" style={{ minHeight: "60vh" }}>
        <div className="row">
          <div className="col-sm-12 mt-3 mb-4">
            <h1 className="h4 mb-3">
              <L en="4D Draw Schedule" ms="Jadual Cabutan 4D" zh="开彩时间表" />
            </h1>
            <p>
              <L
                en="All draw times below are Malaysia time (GMT+8). Draws do not start and finish at a fixed moment — the numbers are released over roughly ten minutes to an hour, so the times shown are when the draw begins, not when the last number appears."
                ms="Semua masa cabutan di bawah ialah waktu Malaysia (GMT+8). Cabutan tidak bermula dan tamat pada satu ketika yang tetap — nombor dikeluarkan dalam tempoh lebih kurang sepuluh minit hingga satu jam, jadi masa yang ditunjukkan ialah apabila cabutan bermula, bukan apabila nombor terakhir muncul."
                zh="以下全部是马来西亚时间（GMT+8）。开彩不是一瞬间完成的，号码会在十分钟到一小时内陆续公布，所以表上的时间是开彩开始的时间，不是最后一个号码出现的时间。"
              />
            </p>

            <div className="alert alert-secondary small">
              <L
                en="Draw days and times are set by each operator and can change. If a special draw is announced, the operators publish the date — the ones we know are listed below."
                ms="Hari dan masa cabutan ditetapkan oleh setiap pengendali dan boleh berubah. Jika cabutan khas diumumkan, pengendali akan menerbitkan tarikhnya — yang kami tahu disenaraikan di bawah."
                zh="开彩日期与时间由各营运商决定，可能调整。如有特别开彩，营运商会公布日期，我们会在下方列出已知的。"
              />
            </div>

            <h2 className="h5 mt-4 mb-3">
              <L en="Weekly schedule" ms="Jadual mingguan" zh="每周开彩时间" />
            </h2>
            <div className="table-responsive mb-4">
              <table className="table table-sm table-striped align-middle">
                <thead>
                  <tr>
                    <th>
                      <L en="Game" ms="Permainan" zh="游戏" />
                    </th>
                    <th>
                      <L en="Draw days" ms="Hari cabutan" zh="开彩日" />
                    </th>
                    <th style={{ width: 150 }}>
                      <L en="Starts" ms="Bermula" zh="开始" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SCHEDULE.map((r) => (
                    <tr key={r.game}>
                      <td>
                        <L en={r.game} ms={r.game} zh={r.zh} />
                        {r.note ? (
                          <div className="text-muted small">
                            <L en={r.note.en} ms={r.note.ms} zh={r.note.zh} />
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <L en={r.days.en} ms={r.days.ms} zh={r.days.zh} />
                      </td>
                      <td>{r.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="h5 mt-4 mb-3">
              <L en="Special draws" ms="Cabutan khas" zh="特别开彩" />
            </h2>
            <p>
              <L
                en="Special draws are normally held on a Tuesday, on dates the operators announce. There is no fixed weekly pattern and the number of special draws changes from year to year — usually around ten a year. Magnum 4D, Da Ma Cai, Sports Toto, Sabah 88, Cash Sweep and Sandakan all take part in the same special draws."
                ms="Cabutan khas biasanya diadakan pada hari Selasa, pada tarikh yang diumumkan oleh pengendali. Tiada corak mingguan yang tetap dan bilangan cabutan khas berbeza setiap tahun — biasanya sekitar sepuluh setahun. Magnum 4D, Da Ma Cai, Sports Toto, Sabah 88, Cash Sweep dan Sandakan semuanya menyertai cabutan khas yang sama."
                zh="特别开彩通常落在星期二，日期由营运商公布，没有固定的每周规律，每年次数也不同（一般约十次）。万能、大马彩、多多、沙巴88、砂拉越大万和山打根都会参与同一场特别开彩。"
              />
            </p>
            <div className="table-responsive mb-4">
              <table className="table table-sm table-bordered align-middle">
                <thead>
                  <tr>
                    <th>
                      <L en="Date" ms="Tarikh" zh="日期" />
                    </th>
                    <th>
                      <L en="Day" ms="Hari" zh="星期" />
                    </th>
                    <th>
                      <L en="Draws" ms="Cabutan" zh="参与游戏" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {specialDates.length ? (
                    specialDates.map((iso) => (
                      <tr key={iso}>
                        <td>
                          <strong>{pretty(iso)}</strong>
                        </td>
                        <td>
                          <L en={dayName(iso).en} ms={dayName(iso).ms} zh={dayName(iso).zh} />
                        </td>
                        <td>{SPECIAL_GAMES}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3}>
                        <L
                          en="No special draw has been announced at the moment. This page is updated as soon as the operators publish the next one."
                          ms="Tiada cabutan khas diumumkan buat masa ini. Halaman ini dikemas kini sebaik sahaja pengendali mengumumkan cabutan seterusnya."
                          zh="目前还没有公布特别开彩。营运商一公布，这里就会更新。"
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <h2 className="h5 mt-4 mb-2">
              <L en="Where to see the results" ms="Di mana melihat keputusan" zh="去哪里看成绩" />
            </h2>
            <p>
              <L
                en={<>The <a href="/">live results page</a> updates as each draw is released, and every past draw is kept on the <a href="/past-results">past results</a> pages. To see how often a number has come up, look at the <a href="/statistics">all-time hot numbers</a>, or look up any number in <a href="/number-history">Number History</a>, which goes back to 1985.</>}
                ms={<>Halaman <a href="/">keputusan langsung</a> dikemas kini setiap kali cabutan dikeluarkan, dan setiap cabutan lalu disimpan di halaman <a href="/past-results">keputusan lalu</a>. Untuk melihat berapa kerap sesuatu nombor muncul, lihat <a href="/statistics">nombor panas sepanjang masa</a>, atau cari mana-mana nombor dalam <a href="/number-history">Sejarah Nombor</a>, yang bermula dari 1985.</>}
                zh={<>「<a href="/">最新开奖</a>」会随着每一场开彩更新，过去的每一次开彩都保存在「<a href="/past-results">过去开彩</a>」页面。想知道某个号码出现了多少次，可以看「<a href="/statistics">热门号码</a>」；想查任何一个号码，用「<a href="/number-history">开彩记录</a>」，可以追到 1985 年。</>}
              />
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
