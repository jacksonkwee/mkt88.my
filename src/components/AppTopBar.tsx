"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLang, tr } from "../lib/i18n";

const RED = "#cc0000";
const LOGO = "/sites/mkt88/app/logo-mkt88.webp?v=4";

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
    {/* Sits below the announcement strip when there is one, so the strip is not
        hidden behind the bar and no empty band is left above the first card.
        The status-bar inset is carried by the strip instead (see globals.css),
        so the red block no longer starts with a band above its title. */}
    <div ref={box} style={{ position: "fixed", top: "var(--mkt-notice-h, 0px)", left: 0, right: 0, zIndex: 50, background: RED }}>
      {/* No back button: the Home link is the way out, and the title is
          absolutely centred so it sits in the middle of the bar whatever the
          Home label measures. */}
      <div className="mkt-app-topbar" style={{ position: "relative", background: RED, color: "#fff", display: "flex", alignItems: "center", padding: "10px 8px", minHeight: 48, boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}>
        <div style={{ position: "absolute", left: 0, right: 0, padding: "0 68px", textAlign: "center", fontWeight: 800, fontSize: 17, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", pointerEvents: "none" }}>{tr(titleKey, lang)}</div>
        <Link href="/" onClick={goHome} style={{ color: "#fff", fontSize: 12, textDecoration: "none", padding: "6px 8px", marginLeft: "auto" }}>{tr("home", lang)}</Link>
      </div>

      {/* Brand logo, fixed with the bar. */}
      {/* Kept tight: this block is pinned, so every pixel it takes is a pixel
          the results below never get. */}
      {/* The app's own screens sit under the same palette as the site, so this
          reads the page token instead of a second cold grey (16 Oct 2026). */}
      <div style={{ display: "flex", justifyContent: "center", padding: "5px 0 0", background: "var(--j-page, #f7f7f4)" }}>
        {/* display:contents keeps the link clickable without giving it a box of
            its own, so the logo is laid out exactly as it is on the screens
            that render it as a plain <img loading="lazy"> - one centred item, same size. */}
        <Link href="/" onClick={goHome} aria-label="MKT 88 4D home" style={{ display: "contents" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" src={LOGO} alt="MKT 发发" style={{ height: 44, width: "auto", maxWidth: "70%", display: "block" }} />
        </Link>
      </div>
    </div>
    <div style={{ height }} aria-hidden="true" />
    </>
  );
}
