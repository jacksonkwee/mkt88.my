"use client";

import { useEffect } from "react";

const DEFAULT_LOGO = "/sites/live4dresult-net-0600c55d/root-8a5edab2/logo-mkt88.svg";

export default function SiteCustomizer() {
  useEffect(() => {
    fetch("/api/site-content")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !j.settings) return;
        const s = j.settings;
        const html = document.documentElement;
        html.style.fontSize = (s.fontSize || 16) + "px";
        html.style.setProperty("--primary", s.primary || "#cc0000");
        const size = Math.max(20, Number(s.logo?.size) || 70);
        document.querySelectorAll("header a img").forEach((img) => {
          const el = img as HTMLImageElement;
          if (s.logo?.src) el.src = s.logo.src;
          el.style.height = size + "px";
          el.style.width = "auto";
        });
      })
      .catch(() => {});
  }, []);
  return null;
}
