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
 * The highlight is only applied to numbers that appear AFTER the page has
 * settled, so a page you open mid-draw does not light up everything at once.
 */

// Specials and Consolations only - the 1st/2nd/3rd prize cells are left alone.
const PRIZE_CELL = /^(special-\d+|consolation-\d+)$/;
const CLASS = "mkt-new-number";
const HOLD_MS = 7000;

export default function LiveHighlight({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const seen = new Map<Element, string>();
    const timers = new Map<Element, number>();
    let primed = false;

    const mark = (el: Element) => {
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
      for (const el of Array.from(document.querySelectorAll("[data-id]"))) {
        const id = el.getAttribute("data-id") || "";
        if (!PRIZE_CELL.test(id)) continue;
        const v = (el.textContent || "").trim();
        const before = seen.get(el);
        seen.set(el, v);
        if (!primed) continue;
        if (/^\d{4}$/.test(v) && before !== v && !/^\d{4}$/.test(before || "")) mark(el);
      }
      primed = true;
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
