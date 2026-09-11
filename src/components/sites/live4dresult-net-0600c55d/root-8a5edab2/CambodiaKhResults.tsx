"use client";

import { useEffect, useState } from "react";
import LotteryCard, { type LotteryCardData } from "./LotteryCard";

interface SetData { prize: string[]; special: string[]; cons: string[]; date?: string; drawNo?: string; }

const td = (cls: string, html: string, attrs: Record<string, string> = {}) => ({ tag: "td" as const, cls, attrs, html });
const titleRow = (text: string, colspan = 5) => ({ cls: "", cells: [td("lottery-prize-title text-center", text, { colspan: String(colspan) })] });
const numberRow = (arr: string[]) => ({ cls: "", cells: arr.map((v) => td("border text-center lottery-number", v, { width: "20%" })) });

function prizeTable(rows: Array<[string, string]>) {
  return {
    cls: "my-1", widthAttr: "100%",
    rows: rows.map(([label, num]) => {
      const isJp = /(pool|jackpot|amount)/i.test(label) || (/(prize|Prize)/.test(label) && num.includes(" + "));
      const v = isJp ? '<span class="jp-amount">' + num + "</span>" : num;
      return { cls: "", cells: [td("lottery-prize-title text-center", label, { width: "45%" }), td("lottery-prize-number border text-center", v)] };
    }),
  };
}
function gridTable(title: string, values: string[], chunk = 5) {
  const rows = [titleRow(title, 5)];
  const padded = values.slice();
  while (padded.length % chunk !== 0) padded.push("&nbsp;");
  for (let i = 0; i < padded.length; i += chunk) rows.push(numberRow(padded.slice(i, i + chunk)));
  return { cls: "my-1", widthAttr: "100%", rows };
}
function moreTable(label: string) {
  return { cls: "text-center", widthAttr: "100%", rows: [{ cls: "", cells: [td("", '<a href="#" style="text-decoration: none"><div class="anchor">' + label + "</div></a>")] }] };
}

const LOGO = {
  gd: "/wp-content/themes/oldtheme-lottery-frontend/assets/images/logo_granddragon.jpg?v=1",
  nine: "/wp-content/themes/oldtheme-lottery-frontend/assets/images/logo_ninelotto.png?v=1",
  perdana: "/wp-content/themes/oldtheme-lottery-frontend/assets/images/logo_perdana.jpg?v=1",
  hari: "/wp-content/themes/oldtheme-lottery-frontend/assets/images/logo_harihari.jpg?v=1",
};

function labelDate(iso: string): string {
  if (/^\d{2}-\d{2}-\d{4}/.test(iso)) return iso;
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  const [y, m, dd] = iso.split("-");
  const w = d.toLocaleDateString("en-US", { weekday: "short" });
  return dd + "-" + m + "-" + y + " (" + w + ")";
}

function fourCard(o: { id: string; cardCls: string; bg: string; logo: string; name: string; date: string; set: SetData; more: string; extra?: Array<[string, string]> }): LotteryCardData {
  const prize: Array<[string, string]> = [["1st Prize 首獎", o.set.prize[0] || "----"], ["2nd Prize 二獎", o.set.prize[1] || "----"], ["3rd Prize 三獎", o.set.prize[2] || "----"]];
  const tables: LotteryCardData["tables"] = [prizeTable(prize), gridTable("Special 特別獎", o.set.special), gridTable("Consolation 安慰獎", o.set.cons)];
  if (o.extra && o.extra.length) tables.push(prizeTable(o.extra));
  tables.push(moreTable(o.more));
  return {
    id: o.id, cardCls: o.cardCls,
    header: { bgCls: o.bg, logo: { src: o.logo, alt: "logo" }, name: o.name, date: o.date, drawNo: o.set.drawNo || null },
    tables,
  };
}

function sixCard(o: { id: string; cardCls: string; bg: string; logo: string; name: string; date: string; main?: string; subs?: Record<string, string>; extras?: Array<[string, string]> }): LotteryCardData {
  const rows: Array<[string, string]> = [["1st Prize 首獎", o.main || "----"]];
  const or = (a?: string, b?: string) => (a && a !== "----" ? a : "----") + " or " + (b && b !== "----" ? b : "----");
  rows.push(["2nd Prize 二獎", or(o.subs?.six_2a, o.subs?.six_2b)]);
  rows.push(["3rd Prize 三獎", or(o.subs?.six_3a, o.subs?.six_3b)]);
  rows.push(["4th Prize 四獎", or(o.subs?.six_4a, o.subs?.six_4b)]);
  rows.push(["5th Prize 五獎", or(o.subs?.six_5a, o.subs?.six_5b)]);
  return {
    id: o.id, cardCls: o.cardCls,
    header: { bgCls: o.bg, logo: { src: o.logo, alt: "logo" }, name: o.name, date: o.date, drawNo: null },
    tables: [prizeTable(rows)],
  };
}

function jpCard(o: { id: string; cardCls: string; bg: string; logo: string; name: string; date: string; extras: Array<[string, string]> }): LotteryCardData {
  return {
    id: o.id + "-jp",
    cardCls: o.cardCls + " six-jp",
    header: { bgCls: o.bg, logo: { src: o.logo, alt: "logo" }, name: o.name.replace(/6D/, "6D JP"), date: o.date, drawNo: null },
    tables: [prizeTable(o.extras)],
  };
}

interface ApiResult {
  date: string;
  gd?: SetData | null;
  nine?: SetData | null;
  gd6?: { main: string; subs: Record<string, string> } | null;
  gdjp4?: Record<string, string> | null;
  gdjp7?: Record<string, string> | null;
  nine6?: { main: string; subs: Record<string, string> } | null;
  nineJp?: Record<string, string> | null;
  perdana?: Record<string, SetData | null>;
  hari?: Record<string, { set: SetData | null; six?: { main: string; subs: Record<string, string> } | null; jp?: Record<string, string> | null } | null>;
}

export default function CambodiaKhResults({ date, only }: { date: string; only?: "gd" | "nine" | "perdana" | "hari" }) {
  const [cols, setCols] = useState<LotteryCardData[][] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/cambodia-past?date=" + date)
      .then(async (r) => {
        if (!r.ok) throw new Error("load failed");
        const j = (await r.json()) as ApiResult;
        if (!alive) return;
        const d = labelDate(date);
        const columns: LotteryCardData[][] = [];
        const want = (g: string) => !only || only === g;
        // Grand Dragon 4D (+4D jackpot) then 6D (+6+1D jackpot)
        const gdCol: LotteryCardData[] = [];
        if (j.gd && j.gd.prize && j.gd.prize.length) {
          const extra: Array<[string, string]> = [];
          if (j.gdjp4) {
            if (j.gdjp4.jp4_pool) extra.push(["Jackpot Pool 積宝奖金池", j.gdjp4.jp4_pool]);
            if (j.gdjp4.jp4_letter) extra.push(["Jackpot Letter 开彩字母", j.gdjp4.jp4_letter]);
            if (j.gdjp4.jp4_units) extra.push(["Winning Units 中奖注数", j.gdjp4.jp4_units]);
          }
          gdCol.push(fourCard({ id: date + "-gd4", cardCls: "card outer-box table-13", bg: "granddragon-bg", logo: LOGO.gd, name: "Grand Dragon 4D 豪龙", date: j.gd.date || d, set: j.gd, more: "More GrandDragon 4D Result", extra: extra.length ? extra : undefined }));
        }
        const gdExtras: Array<[string, string]> = [];
        if (j.gd6) {
          if (j.gdjp7) {
            if (j.gdjp7.jp7_pool) gdExtras.push(["6+1D JP Pool 奖金池", j.gdjp7.jp7_pool]);
            if (j.gdjp7.jp7_grand) gdExtras.push(["6+1D Grand Prize 头奖", j.gdjp7.jp7_grand]);
          }
          gdCol.push(sixCard({ id: date + "-gd6", cardCls: "card outer-box table-14", bg: "granddragon-bg", logo: LOGO.gd, name: "Grand Dragon 6D 豪龙", date: d, main: j.gd6.main, subs: j.gd6.subs }));
        }
        if (want("gd") && gdCol.length) columns.push(gdCol);
        if (want("gd") && gdExtras.length) columns.push([jpCard({ id: date + "-gd6", cardCls: "card outer-box table-14", bg: "granddragon-bg", logo: LOGO.gd, name: "Grand Dragon 6D 豪龙", date: d, extras: gdExtras })]);

        // Nine Lotto 4D then 6D (+ Super Jackpot)
        const nineCol: LotteryCardData[] = [];
        if (j.nine && j.nine.prize && j.nine.prize.length) {
          nineCol.push(fourCard({ id: date + "-nine", cardCls: "card outer-box table-17", bg: "nine lotto-bg", logo: LOGO.nine, name: "Nine Lotto", date: j.nine.date || d, set: j.nine, more: "More Nine Lotto 4D Result" }));
        }
        const nineExtras: Array<[string, string]> = [];
        if (j.nine6) {
          if (j.nineJp) {
            if (j.nineJp.n9_sj_pool) nineExtras.push(["Super Jackpot Pool 奖池", j.nineJp.n9_sj_pool]);
            if (j.nineJp.n9_sj_grand) nineExtras.push(["Grand Prize 头奖", j.nineJp.n9_sj_grand]);
            if (j.nineJp.n9_sj_super) nineExtras.push(["Super Prize 大奖", j.nineJp.n9_sj_super]);
            if (j.nineJp.n9_sj_minor) nineExtras.push(["Minor Prize 小奖", j.nineJp.n9_sj_minor]);
          }
          nineCol.push(sixCard({ id: date + "-nine6", cardCls: "card outer-box table-18", bg: "nine lotto-bg", logo: LOGO.nine, name: "Nine Lotto 6D", date: d, main: j.nine6.main, subs: j.nine6.subs }));
        }
        if (want("nine") && nineCol.length) columns.push(nineCol);
        if (want("nine") && nineExtras.length) columns.push([jpCard({ id: date + "-nine6", cardCls: "card outer-box table-18", bg: "nine lotto-bg", logo: LOGO.nine, name: "Nine Lotto 6D", date: d, extras: nineExtras })]);

        // Perdana 4D (two draws)
        const p = j.perdana || {};
        const perd = (t: string, id: string, nm: string, more: string) => {
          const s = p[t];
          if (want("perdana") && s && s.prize && s.prize.length) columns.push([fourCard({ id, cardCls: "card outer-box table-16", bg: "perdana-bg", logo: LOGO.perdana, name: nm, date: s.date || d, set: s, more })]);
        };
        perd("15:30", date + "-perd1530", "Perdana Lottery 4D (15:30)", "More Perdana 4D Result");
        perd("19:30", date + "-perd1930", "Perdana Lottery 4D (19:30)", "More Perdana 4D Result");

        // Lucky HariHari 4D then 6D (+ jackpot) for both draws
        const h = j.hari || {};
        const hari = (t: string, id4: string, nm4: string) => {
          const slot = h[t];
          if (!slot) return;
          const col: LotteryCardData[] = [];
          if (slot.set && slot.set.prize && slot.set.prize.length) {
            col.push(fourCard({ id: id4, cardCls: "card outer-box table-15", bg: "luckyharihari-bg", logo: LOGO.hari, name: nm4, date: slot.set.date || d, set: slot.set, more: "More LuckyHariHari 4D Result" }));
          }
          const extras: Array<[string, string]> = [];
          if (slot.jp) {
            if (slot.jp.jp_pool) extras.push(["Jackpot Pool 奖金池", slot.jp.jp_pool]);
            if (slot.jp.jp_no) extras.push(["Jackpot No. 开奖号码", slot.jp.jp_no]);
          }
          if (slot.six) {
            col.push(sixCard({ id: id4 + "-6d", cardCls: "card outer-box table-19", bg: "luckyharihari-bg", logo: LOGO.hari, name: nm4.replace("4D", "6D"), date: d, main: slot.six.main, subs: slot.six.subs }));
          }
          if (want("hari") && col.length) columns.push(col);
          if (want("hari") && extras.length) columns.push([jpCard({ id: id4 + "-6d", cardCls: "card outer-box table-19", bg: "luckyharihari-bg", logo: LOGO.hari, name: nm4.replace("4D", "6D"), date: d, extras })]);
        };
        hari("15:30", date + "-hari330", "Lucky HariHari 天天好运 (3:30PM)");
        hari("19:30", date + "-hari730", "Lucky HariHari 天天好运 (7:30PM)");

        if (columns.length) setCols(columns);
        else setErr("No results are included for " + date + ".");
      })
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, [date, only]);

  if (err) return <div className="alert alert-warning mt-3 text-center">{err}</div>;
  if (!cols) return <div className="alert alert-info mt-3 text-center">Loading Cambodia results…</div>;
  return (
    <div className="row">
      {cols.map((col, ci) => (
        <div key={ci} className="col-12 col-sm-12 col-md-6 col-lg-4 mt-3 px-1">
          {col.map((c, ii) => (
            <div key={c.id} className={ii > 0 ? "mt-3" : ""}>
              <LotteryCard card={c} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
