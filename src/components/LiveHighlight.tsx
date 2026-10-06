"use client";

import { useEffect } from "react";

/**
 * Marks each newly published number on the 11 game result cards with a red
 * background that fades away.
 *
 * During a draw the page is refreshed every few seconds and single cells change
 * from "----" to a four-digit number. Watching for that change is enough to
 * know which numbers are the newest - no extra data is needed.
 *
 * Two guards keep the page from lighting up red when it is merely drawing
 * itself:
 *  - the cards are rendered in batches, so nothing is marked while the number
 *    of cells is still growing;
 *  - a cell is only marked once it has already been seen in an earlier scan.
 * Without those, loading the app marked every Special and Consolation column
 * red at once.
 */

// Specials and Consolations only - the 1st/2nd/3rd prize cells are left alone.
const PRIZE_CELL = /^(special-\d+|consolation-\d+)$/;
const CLASS = "mkt-new-number";
/** Matches the 3s mktNewNumberFade animation in globals.css. */
const HOLD_MS = 3000;

/**
 * Draw windows, Malaysia time. Outside these the page is only tidying itself
 * up, so nothing should knock or flash.
 */
function inDrawWindow(): boolean {
  const my = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const mins = my.getUTCHours() * 60 + my.getUTCMinutes();
  return (mins >= 15 * 60 && mins <= 16 * 60 + 30) || (mins >= 18 * 60 && mins <= 21 * 60);
}

type CellState = { last: string; nums: Set<string> };

export default function LiveHighlight({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const state = new Map<Element, CellState>();
    const timers = new Map<Element, number>();
    let lastCellCount = -1;

    const mark = (el: Element) => {
      if (!inDrawWindow()) return;
      el.classList.remove(CLASS);
      // Force the browser to notice, so the fade restarts for a number that
      // changes twice in a row.
      void (el as HTMLElement).offsetWidth;
      el.classList.add(CLASS);
      const old = timers.get(el);
      if (old) window.clearTimeout(old);
      timers.set(el, window.setTimeout(() => {
        el.classList.remove(CLASS);
        timers.delete(el);
      }, HOLD_MS));
    };

    const scan = () => {
      const cells = Array.from(document.querySelectorAll("[data-id]")).filter(
        (el) => PRIZE_CELL.test(el.getAttribute("data-id") || "")
      );

      // Still building: more cells than last time. Anything showing up now is
      // the page rendering, not a number being revealed, so only take note.
      const building = cells.length !== lastCellCount;
      lastCellCount = cells.length;

      for (const el of cells) {
        const v = (el.textContent || "").trim();
        const prev = state.get(el);
        if (!prev) {
          state.set(el, { last: v, nums: new Set(/^\d{4}$/.test(v) ? [v] : []) });
          continue;
        }
        if (prev.last === v) continue;
        prev.last = v;
        if (building) continue;
        if (!/^\d{4}$/.test(v)) continue;
        if (prev.nums.has(v)) continue;
        prev.nums.add(v);
        mark(el);
      }
    };

    scan();
    const timer = window.setInterval(scan, 900);
    return () => {
      window.clearInterval(timer);
      for (const t of timers.values()) window.clearTimeout(t);
    };
  }, [enabled]);

  return null;
}