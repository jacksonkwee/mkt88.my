"use client";

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

export default function LiveSound({ enabled = false }: { enabled?: boolean }) {
  const ctxRef = useRef<AudioContext | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const seeded = useRef(false);

  // Browsers block sound until the user has touched the page at least once.
  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

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

    /** Which game this card is, plus which draw - so a new draw chimes again. */
    const keyOf = (card: Element): string | null => {
      for (const id of READY_IDS) {
        const el = card.querySelector('[data-id="' + id + '"]');
        if (!isReady(el)) continue;
        const date = card.querySelector('[data-id="date"]');
        const name = card.querySelector(".lottery-name");
        return (name ? name.textContent : card.className) + "|" + id + "|" + (date ? date.textContent : "");
      }
      return null;
    };

    const cards = () => Array.from(document.querySelectorAll(".card.outer-box:not(.mkt-past)"));

    const check = () => {
      for (const card of cards()) {
        const key = keyOf(card);
        if (!key || seen.current.has(key)) continue;
        seen.current.add(key);
        if (seeded.current) beep();
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
  }, [enabled]);

  return null;
}
