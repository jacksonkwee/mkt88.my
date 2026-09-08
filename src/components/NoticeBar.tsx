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
  if (fx === "marquee") return "fx-marquee";
  return "";
}

export default function NoticeBar() {
  const [n, setN] = useState<Notice | null>(null);
  useEffect(() => {
    fetch("/api/site-content")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setN(j.notice))
      .catch(() => {});
  }, []);
  if (!n || !n.enabled || !n.text) return null;
  const fx = fxClass(n.fx);
  return (
    <div style={{ background: n.bg, color: n.color, textAlign: "center", padding: "8px 12px", fontSize: 15, fontWeight: 600 }}>
      {n.fx === "marquee" ? (
        <div className={fx}>
          <span>{n.text}</span>
        </div>
      ) : (
        <div className={fx}>{n.text}</div>
      )}
    </div>
  );
}
