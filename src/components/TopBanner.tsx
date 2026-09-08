"use client";

import { useEffect, useState } from "react";

export default function TopBanner() {
  const [src, setSrc] = useState("");
  useEffect(() => {
    fetch("/api/site-content")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && j.settings && j.settings.banner && j.settings.banner.enabled) setSrc(j.settings.banner.src || "");
        else setSrc("");
      })
      .catch(() => {});
  }, []);
  if (!src) return null;
  return (
    <div style={{ textAlign: "center", background: "#111", padding: "6px 10px" }}>
      <img src={src} alt="banner" style={{ maxWidth: "100%", maxHeight: 90, borderRadius: 6 }} />
    </div>
  );
}
