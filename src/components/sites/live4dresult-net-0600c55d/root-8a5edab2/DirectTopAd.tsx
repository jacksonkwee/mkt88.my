"use client";

import { useEffect, useState } from "react";

interface Unit { enabled: boolean; image: string; link: string; }
interface Ph { enabled: boolean; text: string; link: string; }

export default function DirectTopAd() {
  const [top, setTop] = useState<Unit | null>(null);
  const [ph, setPh] = useState<Ph | null>(null);
  useEffect(() => {
    fetch("/api/site-content")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && j.ads && j.ads.direct) {
          setTop(j.ads.direct.top);
          setPh(j.ads.direct.placeholder);
        }
      })
      .catch(() => {});
  }, []);
  if (top && top.enabled && top.image) {
    return (
      <div style={{ textAlign: "center", margin: "10px 0" }}>
        <a href={top.link || "#"} target={top.link ? "_blank" : undefined} rel="noreferrer">
          <img src={top.image} alt="Advertisement" style={{ maxWidth: "100%", borderRadius: 6 }} />
        </a>
      </div>
    );
  }
  if (ph && ph.enabled && ph.text) {
    return (
      <div style={{ textAlign: "center", margin: "10px 0" }}>
        <a
          href={ph.link || "#"}
          target={ph.link ? "_blank" : undefined}
          rel="noreferrer"
          style={{ display: "block", border: "1px dashed #aaa", color: "#555", padding: "18px", fontSize: 14, textDecoration: "none", borderRadius: 6, background: "#fafafa" }}
        >
          {ph.text}
        </a>
      </div>
    );
  }
  return null;
}
