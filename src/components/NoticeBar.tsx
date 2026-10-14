"use client";

import { useEffect, useRef, useState } from "react";

interface Notice {
  enabled: boolean;
  text: string;
  bg: string;
  color: string;
  fx: string;
}

function fxClass(fx: string) {
  if (fx === "blink") return "fx-blink";
  if (fx === "pulse") return "fx-pulse";
  return "";
}

/**
 * The admin's announcement strip, above everything else on the page.
 *
 * Its text, colours and effect come from Settings → 📣 Announcement bar. With
 * "Marquee" the line scrolls; two copies are laid side by side and the track
 * moves by exactly half its own width, so one copy is always on screen and the
 * strip never shows an empty gap between passes.
 */
export default function NoticeBar() {
  const [n, setN] = useState<Notice | null>(null);
  const track = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    fetch("/api/site-content")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setN(j.notice))
      .catch(() => {});
  }, []);

  /*
   * Keep the scrolling speed the same whatever the announcement says.
   *
   * The animation time used to be fixed, so a long line crawled along while a
   * short one flew - the special-draw announcement was long enough to look
   * almost still (reported 14 Oct 2026). One copy of the line travels one copy's
   * width, so the time is worked out from that width: about 70px a second.
   */
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const fit = () => {
      const copy = el.scrollWidth / 2;
      if (copy > 0) el.style.animationDuration = Math.max(6, Math.round(copy / 70)) + "s";
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [n]);

  if (!n || !n.enabled || !n.text) return null;

  const style = { background: n.bg, color: n.color, padding: "8px 0", fontSize: 15, fontWeight: 600 };
  if (n.fx === "marquee") {
    return (
      <div className="fx-marquee" style={style} aria-label={n.text}>
        <div className="fx-marquee-track" ref={track}>
          <span>{n.text}</span>
          <span aria-hidden="true">{n.text}</span>
        </div>
      </div>
    );
  }
  return <div className={fxClass(n.fx)} style={{ ...style, padding: "8px 12px", textAlign: "center" }}>{n.text}</div>;
}
