"use client";

import { useEffect, useState } from "react";
import LotteryCard, { type LotteryCardData } from "./LotteryCard";
import { rewriteHtml } from "./site-paths";

interface SetData {
  prize: string[];
  special: string[];
  cons: string[];
  date?: string;
  drawNo?: string;
}

const td = (cls: string, html: string, attrs: Record<string, string> = {}) => ({ tag: "td" as const, cls, attrs, html });
const titleRow = (text: string, colspan = 5) => ({ cls: "", cells: [td("lottery-prize-title text-center", text, { colspan: String(colspan) })] });
const numberRow = (arr: string[]) => ({ cls: "", cells: arr.map((v) => td("border text-center lottery-number", v, { width: "20%" })) });

function prizeTable(rows: Array<[string, string]>) {
  return {
    cls: "my-1", widthAttr: "100%",
    rows: rows.map(([label, num]) => ({
      cls: "",
      cells: [
        td("lottery-prize-title text-center", label, { width: "45%" }),
        td("lottery-prize-number border text-center", num),
      ],
    })),
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
  return {
    cls: "text-center", widthAttr: "100%",
    rows: [{ cls: "", cells: [td("", '<a href="#" style="text-decoration: none"><div class="anchor">' + label + "</div></a>")] }],
  };
}

function makeCard(opts: {
  id: string; cardCls: string; bg: string; logo: string; name: string; date: string;
  drawNo?: string | null; set: SetData; more: string;
}): LotteryCardData {
  const prize: Array<[string, string]> = [
    ["1st Prize 首獎", opts.set.prize[0] || "----"],
    ["2nd Prize 二獎", opts.set.prize[1] || "----"],
    ["3rd Prize 三獎", opts.set.prize[2] || "----"],
  ];
  return {
    id: opts.id,
    cardCls: opts.cardCls,
    header: { bgCls: opts.bg, logo: { src: opts.logo, alt: "logo" }, name: opts.name, date: opts.date, drawNo: opts.drawNo || null },
    tables: [prizeTable(prize), gridTable("Special 特別獎", opts.set.special), gridTable("Consolation 安慰獎", opts.set.cons), moreTable(opts.more)],
  };
}

const ASSET = "/sites/live4dresult-net-0600c55d/root-8a5edab2";
const LOGO = {
  perdana: "/wp-content/themes/oldtheme-lottery-frontend/assets/images/logo_perdana.jpg?v=1",
  hari: "/wp-content/themes/oldtheme-lottery-frontend/assets/images/logo_harihari.jpg?v=1",
};

export default function CambodiaKhResults({ date }: { date: string }) {
  const [cards, setCards] = useState<LotteryCardData[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/cambodia-past?date=" + date)
      .then(async (r) => {
        if (!r.ok) throw new Error("load failed");
        const j = await r.json();
        if (!alive) return;
        const built: LotteryCardData[] = [];
        const push = (o: Parameters<typeof makeCard>[0]) => built.push(makeCard(o));
        const p = j.perdana || {};
        if (p["15:30"]) push({ id: date + "-perd1530", cardCls: "card outer-box table-16", bg: "perdana-bg", logo: LOGO.perdana, name: "Perdana Lottery 4D (15:30)", date: p["15:30"].date || date, drawNo: null, set: p["15:30"], more: "More Perdana 4D Result" });
        if (p["19:30"]) push({ id: date + "-perd1930", cardCls: "card outer-box table-16", bg: "perdana-bg", logo: LOGO.perdana, name: "Perdana Lottery 4D (19:30)", date: p["19:30"].date || date, drawNo: null, set: p["19:30"], more: "More Perdana 4D Result" });
        const h = j.hari || {};
        if (h["15:30"]) push({ id: date + "-hari330", cardCls: "card outer-box table-15", bg: "luckyharihari-bg", logo: LOGO.hari, name: "Lucky HariHari 天天好运 (3:30PM)", date: h["15:30"].date || date, drawNo: h["15:30"].drawNo || null, set: h["15:30"], more: "More LuckyHariHari 4D Result" });
        if (h["19:30"]) push({ id: date + "-hari730", cardCls: "card outer-box table-15", bg: "luckyharihari-bg", logo: LOGO.hari, name: "Lucky HariHari 天天好运 (7:30PM)", date: h["19:30"].date || date, drawNo: h["19:30"].drawNo || null, set: h["19:30"], more: "More LuckyHariHari 4D Result" });
        setCards(built);
      })
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, [date]);

  if (err) return <div className="alert alert-warning mt-3 text-center">Could not load Cambodia results: {err}</div>;
  if (!cards) return <div className="alert alert-info mt-3 text-center">Loading Cambodia results…</div>;

  return (
    <div>
      {cards.length ? (
        <div className="row">
          {cards.map((c) => (
            <div key={c.id} className="col-12 col-sm-12 col-md-6 col-lg-4 mt-3 px-1">
              <LotteryCard card={c} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
