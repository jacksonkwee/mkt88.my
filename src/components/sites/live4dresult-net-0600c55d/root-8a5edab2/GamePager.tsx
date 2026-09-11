"use client";

import { useEffect, useRef } from "react";
import LotteryCard, { type LotteryCardData } from "./LotteryCard";
import { rewriteHtml } from "./site-paths";
import cardsRaw from "./cards-data.json";
import lottoRaw from "./lotto-data.json";
import eastRaw from "./snapshots/sabah-sarawak-4d-results.content.json";
import { hariIds, perdanaIds } from "./draw-order";
import { useDrawOrder } from "./use-draw-order";
import { overridesFor, useSnap } from "./use-live-snapshot";
import { splitSixCard } from "./six-split";
import GamePastFilter from "./GamePastFilter";

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

type PageDef = { title: string; slug?: string; kh?: boolean; ids?: string[]; html?: string };

/** Raw captured HTML is written once (React must not re-insert it on re-render,
 *  otherwise the freshly applied live values are wiped back to the capture). */
function RawHtml({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== html) ref.current.innerHTML = html;
  }, [html]);
  return <div ref={ref} />;
}
const PAGES: PageDef[] = [
  { title: "Magnum 4D", slug: "magnum", ids: ["table-1-2026-09-06", "table-3-2026-09-06", "table-2-2026-09-06"] },
  { title: "Da Ma Cai", slug: "damacai", ids: ["table-4-2026-09-06", "table-5-2026-09-06"] },
  { title: "Sports Toto", slug: "sportstoto", ids: ["table-6-2026-09-06", "table-7-2026-09-06"] },
  { title: "Singapore 4D", slug: "sg", ids: ["table-11-2026-09-06"] },
  { title: "Grand Dragon", slug: "grand-dragon", kh: true, ids: ["table-13-2026-09-06", "table-14-2026-09-06-6d"] },
  { title: "Nine Lotto", slug: "nine-lotto", kh: true, ids: ["table-17-2026-09-06", "table-18-2026-09-06-6d"] },
  { title: "Sabah 88 沙巴88", slug: "sabah88", html: extractEast("table-10") },
  { title: "Sandakan 山打根", slug: "sandakan", html: extractEast("table-8") },
  { title: "Cash Sweep 沙捞越", slug: "cashsweep", html: extractEast("table-9") },
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
    { title: "Perdana 4D", slug: "perdana", kh: true, ids: perdanaIds(night) },
    { title: "Lucky HariHari 天天好运", slug: "lucky-harihari", kh: true, ids: hariIds(night) },
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

export default function GamePager({ initialIndex = 0, name, snap: serverSnap, pastDates, showPast }: {
  initialIndex?: number;
  name?: string;
  snap?: unknown;
  pastDates?: { my: string[]; kh: string[]; myTables?: Record<string, string[]> };
  showPast?: boolean;
}) {
  const night = useDrawOrder();
  const ctxSnap = useSnap();
  const snap = (serverSnap as ReturnType<typeof useSnap>) || ctxSnap;
  const pages = pagesFor(night);

  // Raw-HTML slides (Sabah 88 / Sandakan / Cash Sweep) are re-inserted by React
  // during hydration, so write the snapshot values into them here as well.
  useEffect(() => {
    const root = track.current;
    if (!root) return;
    const cards = snap.cards || {};
    for (const [cls, vals] of Object.entries(cards)) {
      for (const card of Array.from(root.querySelectorAll(".card.outer-box." + cls + ":not(.mkt-past)"))) {
        for (const [id, v] of Object.entries(vals)) {
          if (!v || /^----+$/.test(v) || v === "-") continue; // never blank a value
          const el = card.querySelector('[data-id="' + id + '"]');
          if (el && (el.textContent || "").trim() !== v) {
            el.textContent = v;
            el.classList.remove("live-pending");
          }
        }
      }
    }
    const ok = (v?: string) => !!v && !/^----+$/.test(v);
    const put = (card: Element, id: string, v?: string) => {
      if (!ok(v)) return;
      const el = card.querySelector('[data-id="' + id + '"]');
      if (el && (el.textContent || "").trim() !== v) { el.textContent = v as string; el.classList.remove("live-pending"); }
    };
    const writeSix = (baseId: string, m: { main: string; subs?: Record<string, string> } | null | undefined, jp: Record<string, string> | null | undefined) => {
      for (const card of Array.from(root.querySelectorAll('[id="' + baseId + '"]'))) {
        if (!m) continue;
        put(card, "six_main", m.main);
        for (const n of [2, 3, 4, 5]) {
          const a = m.subs?.["six_" + n + "a"], b = m.subs?.["six_" + n + "b"];
          if (!ok(a) && !ok(b)) continue;
          put(card, "six_" + n, (ok(a) ? a : "----") + " or " + (ok(b) ? b : "----"));
        }
      }
      for (const card of Array.from(root.querySelectorAll('[id="' + baseId + '-jp"]'))) {
        if (jp) for (const [id, v] of Object.entries(jp)) put(card, id, v);
      }
    };
    writeSix("table-14-2026-09-06-6d", snap.gd6, snap.gdjp7);
    writeSix("table-18-2026-09-06-6d", snap.nine6, snap.nineJp);
  }, [snap, pages]);
  const idx = name ? gamePagerIndex(name) : initialIndex;
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const lastIdx = useRef(-1);
  const dispatchIdx = (el: HTMLDivElement) => {
    const idx = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    // Swiping to the next game jumps the page back to the top, so the game
    // title and its past-result filter are visible without scrolling up.
    if (idx !== lastIdx.current) {
      const first = lastIdx.current < 0;
      lastIdx.current = idx;
      if (!first) {
        try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { window.scrollTo(0, 0); }
      }
    }
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
        <div key={pg.title} className="mkt-past-scope" style={{ flex: "0 0 100%", scrollSnapAlign: "start", scrollSnapStop: "always", padding: "4px 2px 24px" }}>
          <div style={{ textAlign: "center", fontWeight: 800, color: "#cc0000", margin: "6px 0 2px", fontSize: 16 }}>{pg.title}</div>
          {showPast && pastDates && pg.slug ? (
            <GamePastFilter
              slug={pg.slug}
              name={pg.title}
              kind={pg.kh ? "kh" : "my"}
              dates={pg.kh ? pastDates.kh : pastDates.my}
              tables={pg.kh ? undefined : pastDates.myTables}
            />
          ) : null}
          {pg.html ? (
            <RawHtml html={pg.html} />
          ) : (
            (() => {
              const items: LotteryCardData[] = [];
              for (const id of pg.ids || []) {
                const card = byId.get(id);
                if (!card) continue;
                const { result, jp } = splitSixCard(card);
                items.push(result);
                if (jp) items.push(jp);
              }
              return items.map((card) =>
                / six-jp$/.test(card.cardCls) ? (
                  <div key={card.id} className="mt-3">
                    <LotteryCard card={card} {...overridesFor(snap, card.id, card.cardCls)} />
                  </div>
                ) : (
                  <LotteryCard key={card.id} card={card} {...overridesFor(snap, card.id, card.cardCls)} />
                )
              );
            })()
          )}
        </div>
      ))}
    </div>
  );
}








