"use client";

import { useEffect, useState } from "react";

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
  useEffect(() => {
    fetch("/api/site-content")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setN(j.notice))
      .catch(() => {});
  }, []);
  if (!n || !n.enabled || !n.text) return null;

  const style = { background: n.bg, color: n.color, padding: "8px 0", fontSize: 15, fontWeight: 600 };
  if (n.fx === "marquee") {
    return (
      <div className="fx-marquee" style={style} aria-label={n.text}>
        <div className="fx-marquee-track">
          <span>{n.text}</span>
          <span aria-hidden="true">{n.text}</span>
        </div>
      </div>
    );
  }
  return <div className={fxClass(n.fx)} style={{ ...style, padding: "8px 12px", textAlign: "center" }}>{n.text}</div>;
}
