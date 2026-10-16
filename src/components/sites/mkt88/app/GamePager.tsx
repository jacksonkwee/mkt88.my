"use client";

import { useEffect, useRef, useState } from "react";
import LotteryCard, { type LotteryCardData } from "./LotteryCard";
import cardsRaw from "./cards-data.json";
import lottoRaw from "./lotto-data.json";
import { EAST_CARDS } from "./east-cards";
import { SG_CARDS } from "./sg-cards";
import { hariIds, perdanaIds } from "./draw-order";
import { useDrawOrder } from "./use-draw-order";
import { overridesFor, useSnap } from "./use-live-snapshot";
import { splitSixCard } from "./six-split";
import GamePastFilter from "./GamePastFilter";

const allCards = [
  ...((cardsRaw as unknown as { cards: LotteryCardData[] }).cards || []),
  ...((lottoRaw as unknown as { cards: LotteryCardData[] }).cards || []),
  ...EAST_CARDS,
  ...SG_CARDS,
];
const byId = new Map<string, LotteryCardData>(allCards.map((c) => [c.id, c]));

/** Sortable value for a card date like "28-09-2026 (Mon)". */
function dateScore(label?: string): number {
  const m = /(\d{2})-(\d{2})-(\d{4})/.exec(label || "");
  return m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : 0;
}

type PageDef = { title: string; slug?: string; kh?: boolean; ids?: string[] };
const PAGES: PageDef[] = [
  { title: "Magnum 4D", slug: "magnum", ids: ["table-1-2026-09-06", "table-3-2026-09-06", "table-2-2026-09-06"] },
  { title: "Da Ma Cai", slug: "damacai", ids: ["table-4-2026-09-06", "table-5-2026-09-06"] },
  { title: "Sports Toto", slug: "sportstoto", ids: ["table-6-2026-09-06", "table-7-2026-09-06"] },
  // The Toto card has no live feed, so it is a fixed capture the app shows
  // under the 4D draw, exactly as the website does.
  { title: "Singapore 4D", slug: "sg", ids: ["table-11-2026-09-06", "table-12-2026-09-03"] },
  { title: "Sabah 88 沙巴88", slug: "sabah88", ids: ["table-10-2026-09-06"] },
  { title: "Cash Sweep 沙捞越", slug: "cashsweep", ids: ["table-9-2026-09-06"] },
  { title: "Sandakan 山打根", slug: "sandakan", ids: ["table-8-2026-09-06"] },
  { title: "Grand Dragon", slug: "grand-dragon", kh: true, ids: ["table-13-2026-09-06", "table-14-2026-09-06-6d"] },
  { title: "Nine Lotto", slug: "nine-lotto", kh: true, ids: ["table-17-2026-09-06", "table-18-2026-09-06-6d"] },
];

/**
 * The HariHari slides are time aware: the draw we are waiting for (or the one
 * that just came out) sits on top, and every HariHari 6D result sits directly
 * below its own 4D result. Perdana runs a single 7:30PM draw.
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
  "magnum", "damacai", "sportstoto", "sg", "sabah88", "cashsweep",
  "sandakan", "grand-dragon", "nine-lotto", "perdana", "lucky-harihari",
];
export function gamePagerIndex(name: string): number {
  const i = GAME_PAGER_ORDER.indexOf(name);
  return i >= 0 ? i : 0;
}

export default function GamePager({ initialIndex = 0, name, snap: serverSnap, pastDates, showPast }: {
  initialIndex?: number;
  name?: string;
  snap?: unknown;
  pastDates?: { my: string[]; kh: string[]; myTables?: Record<string, string[]>; khByGame?: Record<string, string[]> };
  showPast?: boolean;
}) {
  const night = useDrawOrder();
  const ctxSnap = useSnap();
  const snap = (serverSnap as ReturnType<typeof useSnap>) || ctxSnap;
  const pages = pagesFor(night);

  // Only the game the visitor opened is sent with the page; the other ten
  // slides are filled in a moment later, right after the first screen paints.
  // One page carrying all eleven games was why every game page opened slowly.
  // The empty slides keep their exact size and order, so the swipe track is
  // sitting on the right game - and can still be swiped - from the first frame.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 250);
    return () => window.clearTimeout(id);
  }, []);

  // Raw-HTML slides (Sabah 88 / Sandakan / Cash Sweep) are re-inserted by React
  // during hydration, so write the snapshot values into them here as well.
  useEffect(() => {
    const root = track.current;
    if (!root) return;
    const cards = snap.cards || {};
    for (const [cls, vals] of Object.entries(cards)) {
      for (const card of Array.from(root.querySelectorAll(".card.outer-box." + cls + ":not(.mkt-past)"))) {
        // A snapshot that is one draw behind must never drag the card - and its
        // date - back to the older result. This write had no such rule, which is
        // how a live card flipped to yesterday and back during a draw.
        const dateEl = card.querySelector('[data-id="date"]');
        const curDay = dateScore(dateEl ? (dateEl.textContent || "") : "");
        const inDay = dateScore(vals.date);
        if (inDay && curDay && inDay < curDay) continue;
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
        if (jp) {
          for (const [id, v] of Object.entries(jp)) put(card, id, v);
        } else {
          // No settled jackpot for this draw: clear the card instead of leaving
          // the previous draw's pool and grand prize under today's date.
          for (const id of ["jp7_pool", "jp7_grand"]) {
            const el = card.querySelector('[data-id="' + id + '"]');
            if (el) el.textContent = "----";
          }
        }
      }
    };
    writeSix("table-14-2026-09-06-6d", snap.gd6, snap.gdjp7);
    writeSix("table-18-2026-09-06-6d", snap.nine6, snap.nineJp);
  }, [snap, pages, ready]);
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
  /** Move the swipe track to a slide without a reload (used by the game icons). */
  const goToIndex = (el: HTMLDivElement, i: number) => {
    const max = Math.max(0, pages.length - 1);
    el.scrollLeft = Math.max(0, Math.min(i, max)) * el.clientWidth;
    dispatchIdx(el);
  };
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let placedWidth = -1;
    // While the page is still settling its width, the slide index flickers;
    // acting on that was what scrolled the page under the user's finger.
    const startedAt = Date.now();
    /**
     * Put the track on the slide this page is for.
     *
     * Inside the app the whole site is hidden while the first page is open, so
     * the track has no layout when this runs. Bailing out there (what it used
     * to do) meant it never tried again, so every game page stayed on the first
     * slide - Magnum - whichever icon was tapped. Wait for the track instead,
     * and re-place it when the width really changes (rotation, resize).
     */
    const place = () => {
      if (el.getClientRects().length === 0 || el.clientWidth === 0) return false;
      if (el.clientWidth !== placedWidth) {
        placedWidth = el.clientWidth;
        el.scrollLeft = Math.max(0, Math.min(idx, pages.length - 1)) * el.clientWidth;
      }
      dispatchIdx(el);
      return true;
    };
    place();
    const timers = [50, 150, 350, 700, 1400].map((ms) => window.setTimeout(place, ms));
    const mo = typeof MutationObserver !== "undefined" ? new MutationObserver(place) : null;
    mo?.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    ro?.observe(el);
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; dispatchIdx(el); });
    };
    el.addEventListener("scroll", onScroll);
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      mo?.disconnect();
      ro?.disconnect();
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tapping a game logo switches the slide directly instead of reloading.
  // Registered even while the track is off screen (desktop width), so a resize
  // down to phone width cannot leave the icons doing nothing.
  useEffect(() => {
    const onGo = (e: Event) => {
      const el = track.current;
      if (!el || el.getClientRects().length === 0) return;
      const d = (e as CustomEvent).detail;
      if (d && typeof d.index === "number") goToIndex(el, d.index);
    };
    window.addEventListener("mktpager-go", onGo);
    return () => window.removeEventListener("mktpager-go", onGo);
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
  /*
   * The swipe track is only as tall as the game being shown.
   *
   * Every slide is `flex: 0 0 100%` in a flex row, so the container was as tall
   * as the TALLEST slide - and with align-items: stretch so was every other
   * slide. On a phone that made the home page 2,743px tall while the Magnum card
   * ended at 888px: about 800px of empty paper between the last number and the
   * footer, and on some games more (measured 16 Oct 2026 at 390px). The track
   * now follows the active slide, and a ResizeObserver keeps it in step so a
   * card that grows while its draw is publishing still fits.
   */
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const slides = Array.from(el.children) as HTMLElement[];
    if (!slides.length) return;
    /*
     * Measured from the scroll position, not from the pager's index: a real
     * swipe and a programmatic scroll both move the track, and only one of them
     * is guaranteed to update the index in time. The track is only as tall as
     * the slide the reader is actually on.
     */
    const sync = () => {
      const left = el.scrollLeft;
      let nearest = slides[0];
      for (const s of slides) if (Math.abs(s.offsetLeft - left) < Math.abs(nearest.offsetLeft - left)) nearest = s;
      const h = nearest.getBoundingClientRect().height;
      if (h > 0) el.style.height = h + "px";
    };
    sync();
    const ro = new ResizeObserver(sync);
    for (const s of slides) ro.observe(s);
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      el.style.height = "";
    };
  }, [idx, ready]);

  return (
    <div ref={track} className="mkt-pager-track"
      style={{ display: "flex", overflowX: "auto", overflowY: "hidden", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", alignItems: "flex-start" }}>
      {pages.map((pg, i) => (
        <div key={pg.title} className="mkt-past-scope" style={{ flex: "0 0 100%", scrollSnapAlign: "start", scrollSnapStop: "always", padding: "4px 2px 24px" }}>
          {!ready && i !== idx ? null : (
          <>
          {showPast && pastDates && pg.slug ? (
            <GamePastFilter
              slug={pg.slug}
              name={pg.title}
              kind={pg.kh ? "kh" : "my"}
              dates={pg.kh ? (pastDates.khByGame?.[pg.slug] || pastDates.kh) : pastDates.my}
              tables={pg.kh ? undefined : pastDates.myTables}
            />
          ) : null}
          {(() => {
            const items: LotteryCardData[] = [];
            for (const id of pg.ids || []) {
              const card = byId.get(id);
              if (!card) continue;
              const { result, jp, sixPlus } = splitSixCard(card);
              items.push(result);
              // The Nine Lotto 6+1D board reads directly under its 6D result,
              // above the 6D JP (Super Jackpot) card.
              if (sixPlus) items.push(sixPlus);
              if (jp) items.push(jp);
            }
            return items.map((card) =>
              / six-jp$| six-one$/.test(card.cardCls) ? (
                <div key={card.id} className="mt-3">
                  <LotteryCard card={card} {...overridesFor(snap, card.id, card.cardCls)} />
                </div>
              ) : (
                <LotteryCard key={card.id} card={card} {...overridesFor(snap, card.id, card.cardCls)} />
              )
            );
          })()}
          </>
          )}
        </div>
      ))}
    </div>
  );
}








