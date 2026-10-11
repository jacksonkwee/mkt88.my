"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLang, tr } from "../lib/i18n";

const RED = "#cc0000";
const LOGO = "/sites/live4dresult-net-0600c55d/root-8a5edab2/logo-mkt88.webp?v=4";

/**
 * The red title bar and the brand logo above the app's own screens.
 *
 * The bar and the logo are one sticky block, so the logo stays where it is
 * while the page scrolls instead of sliding away underneath the bar. The logo
 * is a link home too - tapping it goes back to the first screen, same as the
 * Home link beside it.
 */
export default function AppTopBar({ titleKey }: { titleKey: string }) {
  const [lang] = useLang();
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const goHome = () => window.dispatchEvent(new Event("mkt-home"));

  /*
   * The bar and the logo are pinned, not sticky: on the phone the page under
   * them is the only thing that scrolls, and a sticky block still moves for the
   * first few pixels of an overscroll. The space it takes is measured rather
   * than guessed, so the content starts exactly below it on every screen size
   * and in both the website and the app.
   */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setHeight(el.getBoundingClientRect().height);
    update();
    window.addEventListener("resize", update);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, []);

  return (
    <>
    <div ref={box} style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: RED, paddingTop: "env(safe-area-inset-top)" }}>
      {/* No back button: the Home link is the way out, and the title is
          absolutely centred so it sits in the middle of the bar whatever the
          Home label measures. */}
      <div className="mkt-app-topbar" style={{ position: "relative", background: RED, color: "#fff", display: "flex", alignItems: "center", padding: "10px 8px", minHeight: 48, boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}>
        <div style={{ position: "absolute", left: 0, right: 0, padding: "0 68px", textAlign: "center", fontWeight: 800, fontSize: 18, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", pointerEvents: "none" }}>{tr(titleKey, lang)}</div>
        <Link href="/" onClick={goHome} style={{ color: "#fff", fontSize: 13, textDecoration: "none", padding: "6px 8px", marginLeft: "auto" }}>{tr("home", lang)}</Link>
      </div>

      {/* Brand logo, fixed with the bar. */}
      {/* Kept tight: this block is pinned, so every pixel it takes is a pixel
          the results below never get. */}
      <div style={{ display: "flex", justifyContent: "center", padding: "5px 0 0", background: "#f4f4f4" }}>
        {/* display:contents keeps the link clickable without giving it a box of
            its own, so the logo is laid out exactly as it is on the screens
            that render it as a plain <img> - one centred item, same size. */}
        <Link href="/" onClick={goHome} aria-label="MKT 88 4D home" style={{ display: "contents" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="MKT 发发" style={{ height: 30, width: "auto", maxWidth: "70%", display: "block" }} />
        </Link>
      </div>
    </div>
    <div style={{ height }} aria-hidden="true" />
    </>
  );
}
