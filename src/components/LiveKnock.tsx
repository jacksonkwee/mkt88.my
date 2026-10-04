"use client";

import { isCapacitorApp } from "../lib/is-capacitor-app";

import { useEffect } from "react";

/**
 * A short "knock" as each number of a live draw comes out.
 *
 * On a phone the results page is already being refreshed several times a
 * second while a draw is revealing, so a sound per new number is just a matter
 * of noticing when a cell changes from blank to a four-digit number. The sound
 * is made with the browser's own audio, so no sound file has to be downloaded.
 *
 * Only fires in the installed app, and only for numbers that appear AFTER the
 * page has settled - the numbers that were already on screen when it opened
 * stay silent.
 */

const PRIZE_CELL = /^(first_prize|second_prize|third_prize|special-\d+|consolation-\d+)$/;
const MIN_GAP_MS = 140;

/**
 * Draw windows, Malaysia time. Outside these the page is only tidying itself
 * up, so nothing should knock or flash.
 */
function inDrawWindow(): boolean {
  const my = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const mins = my.getUTCHours() * 60 + my.getUTCMinutes();
  return (mins >= 15 * 60 && mins <= 16 * 60 + 30) || (mins >= 18 * 60 && mins <= 21 * 60 + 30);
}


export default function LiveKnock({ enabled }: { enabled?: boolean }) {
  // Worked out in the page so one cached copy serves the app and the website.
  const on = enabled ?? isCapacitorApp();
  useEffect(() => {
    if (!on) return;
    if (typeof window === "undefined") return;

    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let ctx: AudioContext | null = null;
    let last = 0;

    /** The switch lives in the app Settings page. */
    const soundAllowed = () => {
      try { return window.localStorage.getItem("mkt_live_sound") !== "0"; } catch { return true; }
    };

    /** A knock: a very short, quiet two-tone click. */
    const knock = () => {
      if (!soundAllowed()) return;
      if (!inDrawWindow()) return;
      // The page rewrites cells every few seconds; only a number we have never
      // seen on this cell counts as new.
      const now = Date.now();
      if (now - last < MIN_GAP_MS) return;
      last = now;
      try {
        if (!ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(660, t);
        osc.frequency.exponentialRampToValueAtTime(320, t + 0.07);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.16, t + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.13);
      } catch { /* never let a sound break the results */ }
    };

    // Phones block audio until the user has touched the page once.
    const arm = () => {
      try {
        if (!ctx) {
          const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (Ctor) ctx = new Ctor();
        }
        if (ctx && ctx.state === "suspended") void ctx.resume();
      } catch { ctx = null; }
    };
    window.addEventListener("touchstart", arm, { once: false, passive: true });
    window.addEventListener("click", arm, { once: false, passive: true });

    /** Every four-digit value already seen on each cell. */
    const seen = new Map<Element, Set<string>>();
    let primed = false;

    const scan = () => {
      const cells = document.querySelectorAll("[data-id]");
      for (const el of Array.from(cells)) {
        const id = el.getAttribute("data-id") || "";
        if (!PRIZE_CELL.test(id)) continue;
        const v = (el.textContent || "").trim();
        if (!/^\d{4}$/.test(v)) continue;
        let set = seen.get(el);
        if (!set) { set = new Set<string>(); seen.set(el, set); }
        if (set.has(v)) continue;
        set.add(v);
        // The first pass only records what is already there.
        if (primed) knock();
      }
      primed = true;
    };

    scan();
    const timer = window.setInterval(scan, 1200);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("touchstart", arm);
      window.removeEventListener("click", arm);
      try { void ctx?.close(); } catch { /* ignore */ }
    };
  }, [on]);

  return null;
}
