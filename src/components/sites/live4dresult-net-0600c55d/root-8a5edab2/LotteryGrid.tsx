"use client";

import { useRef } from "react";
import LotteryCard, { type LotteryCardData } from "./LotteryCard";
import { rewriteHtml } from "./site-paths";
import cardsRaw from "./cards-data.json";
import lottoRaw from "./lotto-data.json";
import eastRaw from "./snapshots/sabah-sarawak-4d-results.content.json";

const allCards = [
  ...((cardsRaw as unknown as { cards: LotteryCardData[] }).cards || []),
  ...((lottoRaw as unknown as { cards: LotteryCardData[] }).cards || []),
];
const byId = new Map<string, LotteryCardData>(allCards.map((c) => [c.id, c]));

type ColItem = { type: "card"; id: string } | { type: "br" };

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

const eastHtml = (eastRaw as { colHtml: string }).colHtml || "";
function extractEast(cls: string): string {
  const key = "card outer-box " + cls;
  const s = eastHtml.indexOf(key);
  if (s < 0) return "";
  let i = s, depth = 0;
  while (i < eastHtml.length) {
    const open = eastHtml.indexOf("<div", i);
    const close = eastHtml.indexOf("</div>", i);
    if (close === -1 || (open !== -1 && open < close)) { depth++; i = open + 4; }
    else { depth--; i = close + 6; if (depth === 0) break; }
  }
  return rewriteHtml(eastHtml.slice(s, i));
}
const EAST_HTML: Record<string, string> = {
  sabah88: extractEast("table-10"),
  sandakan: extractEast("table-8"),
  cashsweep: extractEast("table-9"),
};

type PageDef = { title: string; ids?: string[]; html?: string };
const PAGES: PageDef[] = [
  { title: "Magnum 4D", ids: ["table-1-2026-09-06", "table-3-2026-09-06", "table-2-2026-09-06"] },
  { title: "Da Ma Cai", ids: ["table-4-2026-09-06", "table-5-2026-09-06"] },
  { title: "Sports Toto", ids: ["table-6-2026-09-06", "table-7-2026-09-06"] },
  { title: "Singapore 4D", ids: ["table-11-2026-09-06"] },
  { title: "Grand Dragon", ids: ["table-13-2026-09-06", "table-14-2026-09-06-6d"] },
  { title: "Nine Lotto", ids: ["table-17-2026-09-06", "table-18-2026-09-06-6d"] },
  { title: "Sabah 88 沙巴88", html: EAST_HTML.sabah88 },
  { title: "Sandakan 山打根", html: EAST_HTML.sandakan },
  { title: "Cash Sweep 沙捞越", html: EAST_HTML.cashsweep },
  { title: "Perdana 4D", ids: ["table-16-2026-09-06-1530", "table-16-2026-09-06-1930"] },
  { title: "Lucky HariHari 天天好运", ids: ["table-15-2026-09-06-1530", "table-15-2026-09-06-1930"] },
];

function MobilePager() {
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!start.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) return;
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dx < 0 ? el.clientWidth : -el.clientWidth, behavior: "smooth" });
  };
  return (
    <div ref={track} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      style={{ display: "flex", overflowX: "auto", overflowY: "hidden", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
      {PAGES.map((pg) => (
        <div key={pg.title} style={{ flex: "0 0 100%", scrollSnapAlign: "start", padding: "4px 2px" }}>
          <div style={{ textAlign: "center", fontWeight: 800, color: "#cc0000", margin: "6px 0 2px", fontSize: 16 }}>{pg.title}</div>
          {pg.html ? (
            <div dangerouslySetInnerHTML={{ __html: pg.html }} />
          ) : (
            (pg.ids || []).map((id) => { const card = byId.get(id); return card ? <LotteryCard key={card.id} card={card} /> : null; })
          )}
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
      <div className="d-lg-none"><MobilePager /></div>
      <DesktopGrid />
    </div>
  );
}
