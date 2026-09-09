"use client";

import { useEffect, useState } from "react";
import LotteryCard, { type LotteryCardData } from "./LotteryCard";
import LiveResults from "./LiveResults";
import cardsRaw from "./cards-data.json";

const allCards = (cardsRaw as unknown as { cards: LotteryCardData[] }).cards;
const byId = new Map<string, LotteryCardData>(allCards.map((c) => [c.id, c]));

// Malaysia & Singapore games shown for "today" in the past-results view.
const TODAY_IDS = [
  "table-1-2026-09-06",   // Magnum 4D
  "table-3-2026-09-06",   // Magnum Life
  "table-2-2026-09-06",   // Magnum Jackpot Gold
  "table-4-2026-09-06",   // Da Ma Cai 1+3D
  "table-5-2026-09-06",   // Da Ma Cai 3+3D
  "table-6-2026-09-06",   // Sports Toto 4D
  "table-7-2026-09-06",   // Sports Toto 5D/6D
  "table-11-2026-09-06",  // Singapore 4D
];

function todayIso(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
}

function MalaysiaTodayLive() {
  const cards = TODAY_IDS.map((id) => byId.get(id)).filter((c): c is LotteryCardData => Boolean(c));
  return (
    <>
      <div className="row">
        {cards.map((c) => (
          <div key={c.id} className="col-12 col-sm-12 col-md-6 col-lg-4 mt-3 px-1">
            <LotteryCard card={c} />
          </div>
        ))}
      </div>
      <LiveResults />
    </>
  );
}

export default function MalaysiaPastFallback({ date }: { date: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const isToday = date === todayIso();
  useEffect(() => {
    let alive = true;
    fetch("/api/my-past?date=" + date)
      .then(async (r) => {
        if (!r.ok) throw new Error("load failed");
        const j = await r.json();
        if (alive) setHtml(j.html || "");
      })
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, [date]);
  if (err) return <div className="alert alert-warning mt-3 text-center">Could not load results: {err}</div>;
  if (html === null) return <div className="alert alert-info mt-3 text-center">Loading results…</div>;
  if (html !== "") return <div dangerouslySetInnerHTML={{ __html: html }} />;
  if (isToday) return <MalaysiaTodayLive />;
  return <div className="alert alert-warning mt-3 text-center">No Malaysia &amp; Singapore results yet for this date.</div>;
}
