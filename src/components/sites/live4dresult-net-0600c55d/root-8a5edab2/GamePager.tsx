"use client";

import { useEffect, useRef } from "react";
import LotteryCard, { type LotteryCardData } from "./LotteryCard";
import { rewriteHtml } from "./site-paths";
import cardsRaw from "./cards-data.json";
import lottoRaw from "./lotto-data.json";
import eastRaw from "./snapshots/sabah-sarawak-4d-results.content.json";
import { hariIds, perdanaIds } from "./draw-order";
import { useDrawOrder } from "./use-draw-order";

const allCards = [
  ...((cardsRaw as unknown as { cards: LotteryCardData[] }).cards || []),
  ...((lottoRaw as unknown as { cards: LotteryCardData[] }).cards || []),
];
const byId = new Map<string, LotteryCardData>(allCards.map((c) => [c.id, c]));

const eastHtml = (eastRaw as { colHtml: string }).colHtml || "";
function extractEast(cls: string): string {
  // Anchor directly on the real opening div tag.
  const key = '<div class="card outer-box ' + cls + '"';
  let start = eastHtml.indexOf(key);
  if (start < 0) start = eastHtml.indexOf('class="card outer-box ' + cls + '"');
  if (start < 0) return "";
  if (!eastHtml.slice(start, start + 20).startsWith("<div")) {
    const o = eastHtml.lastIndexOf("<div", start);
    start = o >= 0 ? o : start;
  }
  let i = start, depth = 0;
  while (i < eastHtml.length) {
    const o2 = eastHtml.indexOf("<div", i);
    const close = eastHtml.indexOf("</div>", i);
    if (close === -1 || (o2 !== -1 && o2 < close)) { depth++; i = o2 + 4; }
    else { depth--; i = close + 6; if (depth === 0) break; }
  }
  return rewriteHtml(eastHtml.slice(start, i));
}

type PageDef = { title: string; ids?: string[]; html?: string };
const PAGES: PageDef[] = [
  { title: "Magnum 4D", ids: ["table-1-2026-09-06", "table-3-2026-09-06", "table-2-2026-09-06"] },
  { title: "Da Ma Cai", ids: ["table-4-2026-09-06", "table-5-2026-09-06"] },
  { title: "Sports Toto", ids: ["table-6-2026-09-06", "table-7-2026-09-06"] },
  { title: "Singapore 4D", ids: ["table-11-2026-09-06"] },
  { title: "Grand Dragon", ids: ["table-13-2026-09-06", "table-14-2026-09-06-6d"] },
  { title: "Nine Lotto", ids: ["table-17-2026-09-06", "table-18-2026-09-06-6d"] },
  { title: "Sabah 88 沙巴88", html: extractEast("table-10") },
  { title: "Sandakan 山打根", html: extractEast("table-8") },
  { title: "Cash Sweep 沙捞越", html: extractEast("table-9") },
];

/**
 * The Perdana / HariHari slides are time aware: the draw we are waiting for
 * (or the one that just came out) sits on top, and every HariHari 6D result
 * sits directly below its own 4D result.
 */
function pagesFor(night: boolean): PageDef[] {
  const loss = PAGES.filter((p) => p.title !== "Perdana 4D" && !p.title.startsWith("Lucky HariHari"));
  return [
    ...loss,
    { title: "Perdana 4D", ids: perdanaIds(night) },
    { title: "Lucky HariHari 天天好运", ids: hariIds(night) },
  ];
}

/** Game name order used by the icon pages to pick the starting slide. */
export const GAME_PAGER_ORDER = [
  "magnum", "damacai", "sportstoto", "sg", "grand-dragon", "nine-lotto",
  "sabah88", "sandakan", "cashsweep", "perdana", "lucky-harihari",
];
export function gamePagerIndex(name: string): number {
  const i = GAME_PAGER_ORDER.indexOf(name);
  return i >= 0 ? i : 0;
}

export default function GamePager({ initialIndex = 0, name }: { initialIndex?: number; name?: string }) {
  const night = useDrawOrder();
  const pages = pagesFor(night);
  const idx = name ? gamePagerIndex(name) : initialIndex;
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const dispatchIdx = (el: HTMLDivElement) => {
    const idx = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    window.dispatchEvent(new CustomEvent("mktpager", { detail: { index: idx } }));
  };
  const moved = useRef(false);
  useEffect(() => {
    const el = track.current;
    if (!el || el.getClientRects().length === 0) return; // hidden (e.g. desktop) -> no highlight
    el.scrollLeft = Math.max(0, Math.min(idx, pages.length - 1)) * el.clientWidth;
    dispatchIdx(el);
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; dispatchIdx(el); });
    };
    el.addEventListener("scroll", onScroll);
    return () => { el.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
    moved.current = false;
  };
  const onTouchMove = () => { moved.current = true; };
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
    <div ref={track}
      style={{ display: "flex", overflowX: "auto", overflowY: "hidden", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", alignItems: "stretch" }}>
      {pages.map((pg) => (
        <div key={pg.title} style={{ flex: "0 0 100%", scrollSnapAlign: "start", scrollSnapStop: "always", padding: "4px 2px 24px" }}>
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

