"use client";

import { isCapacitorApp } from "./is-capacitor-app";

import { useEffect, useRef } from "react";

/**
 * A short chime when a game's live result arrives.
 *
 * It watches the result cards themselves, so it works whichever source fills
 * them (server snapshot, direct feed, or a native fetch). The chime is made in
 * the browser - no sound file to download - and mobile browsers only allow
 * sound after a touch, so the audio is unlocked on the first tap.
 */
const READY_IDS = ["first_prize", "d5_number_1", "number_1", "six_main"];
const isReady = (el: Element | null) => !!el && /^\d{3,6}$/.test((el.textContent || "").replace(/\s+/g, ""));

export default function LiveSound({ enabled }: { enabled?: boolean }) {
  // Worked out in the page so one cached copy serves the app and the website.
  const on = enabled ?? isCapacitorApp();
  const ctxRef = useRef<AudioContext | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const seeded = useRef(false);

  // Browsers block sound until the user has touched the page at least once.
  useEffect(() => {
    if (!on) return;
    const unlock = () => {
      try {
        const Ctor = window.AudioContext
          || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        if (!ctxRef.current) ctxRef.current = new Ctor();
        if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
      } catch { /* no sound available - everything else still works */ }
    };
    document.addEventListener("touchstart", unlock, { passive: true });
    document.addEventListener("click", unlock);
    return () => {
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };
  }, [on]);

  useEffect(() => {
    if (!on) return;

    const beep = () => {
      let ctx = ctxRef.current;
      if (!ctx) {
        // The first tap usually creates it; make one here too in case it did not.
        try {
          const Ctor = window.AudioContext
            || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (Ctor) ctxRef.current = new Ctor();
          ctx = ctxRef.current;
        } catch { /* no sound available */ }
      }
      if (!ctx) return;
      if (ctx.state === "suspended") { try { void ctx.resume(); } catch { /* ignore */ } }
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;
      [880, 1175].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const at = now + i * 0.16;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.1, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + 0.16);
      });
    };

    /** Which game this card is, which draw, and that draw's date. */
    const keyOf = (card: Element): { key: string; date: string } | null => {
      for (const id of READY_IDS) {
        const el = card.querySelector('[data-id="' + id + '"]');
        if (!isReady(el)) continue;
        const date = (card.querySelector('[data-id="date"]') || {}).textContent || "";
        const name = card.querySelector(".lottery-name");
        return { key: (name ? name.textContent : card.className) + "|" + id + "|" + date, date };
      }
      return null;
    };

    const cards = () => Array.from(document.querySelectorAll(".card.outer-box:not(.mkt-past)"));

    /**
     * Is this card's draw today's?
     *
     * The chime is for a result arriving DURING a draw. A card that fills in
     * with yesterday's draw - which is what happens every time the app opens
     * and the sources catch up - is not news, and that is what rang two or
     * three times on launch. Only today's draw may ring, once per game per
     * draw; a new game's result during the evening rings once each.
     */
    const isToday = (label: string): boolean => {
      const m = /(\d{2})-(\d{2})-(\d{4})/.exec(label || "");
      if (!m) return false;
      const now = new Date(Date.now() + 8 * 3600 * 1000);
      const dd = String(now.getUTCDate()).padStart(2, "0");
      const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
      return m[1] === dd && m[2] === mm && m[3] === String(now.getUTCFullYear());
    };

    const check = () => {
      for (const card of cards()) {
        const hit = keyOf(card);
        if (!hit || seen.current.has(hit.key)) continue;
        seen.current.add(hit.key);
        if (seeded.current && isToday(hit.date)) beep();
      }
    };

    // First pass only records what is already on screen - opening the app must
    // not set off a burst of chimes for results that were already published.
    const seed = window.setTimeout(() => { check(); seeded.current = true; }, 2500);
    const mo = new MutationObserver(check);
    mo.observe(document.body, { subtree: true, childList: true, characterData: true });
    // A slow sweep as a safety net: if a source writes in a way the observer
    // does not see, the chime still arrives.
    const sweep = window.setInterval(check, 5000);
    // Marker so the chime can be checked from outside.
    document.documentElement.setAttribute("data-mkt-sound", "on");
    return () => { window.clearTimeout(seed); window.clearInterval(sweep); mo.disconnect(); };
  }, [on]);

  return null;
}
