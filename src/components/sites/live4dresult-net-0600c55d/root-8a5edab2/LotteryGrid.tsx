"use client";

import { useRef } from "react";
import LotteryCard, { type LotteryCardData } from "./LotteryCard";
import rawCards from "./cards-data.json";

const cardList = (rawCards as unknown as { cards: LotteryCardData[] }).cards;
const byId = new Map<string, LotteryCardData>(cardList.map((c) => [c.id, c]));

type ColItem = { type: "card"; id: string } | { type: "br" };

/** Desktop (web) keeps the original layout with grouped columns. */
const DESKTOP: ColItem[][] = [
  [{ type: "card", id: "table-1-2026-09-06" }],
  [{ type: "card", id: "table-4-2026-09-06" }],
  [{ type: "card", id: "table-6-2026-09-06" }],
  [
    { type: "card", id: "table-3-2026-09-06" },
    { type: "br" },
    { type: "card", id: "table-2-2026-09-06" },
  ],
  [{ type: "card", id: "table-5-2026-09-06" }],
  [{ type: "card", id: "table-7-2026-09-06" }],
  [
    { type: "card", id: "table-13-2026-09-06" },
    { type: "br" },
    { type: "card", id: "table-14-2026-09-06-6d" },
  ],
  [
    { type: "card", id: "table-17-2026-09-06" },
    { type: "br" },
    { type: "card", id: "table-18-2026-09-06-6d" },
  ],
];

/** App / phone: one game per swipeable screen. */
const PAGES = [
  { title: "Magnum 4D", ids: ["table-1-2026-09-06", "table-3-2026-09-06", "table-2-2026-09-06"] },
  { title: "Da Ma Cai", ids: ["table-4-2026-09-06", "table-5-2026-09-06"] },
  { title: "Sports Toto", ids: ["table-6-2026-09-06", "table-7-2026-09-06"] },
  { title: "Singapore 4D", ids: ["table-11-2026-09-06"] },
  { title: "Grand Dragon", ids: ["table-13-2026-09-06", "table-14-2026-09-06-6d"] },
  { title: "Nine Lotto", ids: ["table-17-2026-09-06", "table-18-2026-09-06-6d"] },
];

function MobilePager() {
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!start.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) return;
    const el = track.current;
    if (!el) return;
    const w = el.clientWidth;
    el.scrollBy({ left: dx < 0 ? w : -w, behavior: "smooth" });
  };
  return (
    <div
      ref={track}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        display: "flex",
        overflowX: "auto",
        overflowY: "hidden",
        scrollSnapType: "x mandatory",
        WebkitOverflowScrolling: "touch",
        touchAction: "pan-y",
      }}
    >
      {PAGES.map((pg) => (
        <div key={pg.title} style={{ flex: "0 0 100%", scrollSnapAlign: "start", padding: "4px 2px" }}>
          <div style={{ textAlign: "center", fontWeight: 800, color: "#cc0000", margin: "6px 0 2px", fontSize: 16 }}>
            {pg.title}
          </div>
          {pg.ids.map((id) => {
            const card = byId.get(id);
            return card ? <LotteryCard key={card.id} card={card} /> : null;
          })}
        </div>
      ))}
    </div>
  );
}

function DesktopGrid() {
  return (
    <section className="row d-none d-lg-flex" data-live="">
      {DESKTOP.map((items, ci) => (
        <div key={ci} className="col-12 col-sm-12 col-md-6 col-lg-4 mt-3 px-1">
          {items.map((item, ii) => {
            if (item.type === "br") return <br key={ii} />;
            const card = byId.get(item.id);
            return card ? <LotteryCard key={card.id} card={card} /> : null;
          })}
        </div>
      ))}
    </section>
  );
}

export default function LotteryGrid() {
  return (
    <div id="row">
      <div className="d-lg-none">
        <MobilePager />
      </div>
      <DesktopGrid />
    </div>
  );
}
