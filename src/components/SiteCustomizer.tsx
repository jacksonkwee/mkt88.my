"use client";

import { useEffect } from "react";

const DEFAULT_LOGO = "/sites/live4dresult-net-0600c55d/root-8a5edab2/logo-mkt88.svg";

export default function SiteCustomizer() {
  /**
   * Keep the sticky game-icon row exactly under the header.
   *
   * Its offset was a hardcoded 80px, but the header's real height depends on
   * the logo size and the device, so on some phones a gap opened between the
   * two and the result cards scrolled through it - visible as a card header
   * sitting right behind the logo.
   */
  useEffect(() => {
    const syncOffset = () => {
      const header = document.querySelector("header.sticky-top");
      const row = document.querySelector<HTMLElement>(".header-btn-group");
      if (!header || !row) return;
      const h = Math.round(header.getBoundingClientRect().height);
      if (h > 0) row.style.setProperty("top", h + "px", "important");
    };
    syncOffset();
    window.addEventListener("resize", syncOffset);
    window.addEventListener("orientationchange", syncOffset);
    // The logo size arrives from the site settings a moment after load, which
    // changes the header height - re-measure for a while to catch it.
    const timer = window.setInterval(syncOffset, 1500);
    return () => {
      window.removeEventListener("resize", syncOffset);
      window.removeEventListener("orientationchange", syncOffset);
      window.clearInterval(timer);
    };
  }, []);

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
