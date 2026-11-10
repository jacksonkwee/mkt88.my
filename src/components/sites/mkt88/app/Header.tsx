"use client";

import Link from "next/link";
import { ASSET_BASE } from "./site-paths";
import { isCapacitorApp } from "../../../../lib/is-capacitor-app";
import { tr, useLang } from "../../../../lib/i18n";
import MonthlyBrowsingTime from "../../../MonthlyBrowsingTime";

const logo = ASSET_BASE + "/logo-mkt88.webp?v=4";

/**
 * The site's top menu, shown inline.
 *
 * There is no hamburger any more: these five pages are the ones people move
 * between all evening, and the three-line button hid them behind a tap. The row
 * wraps on a narrow phone instead of collapsing.
 */
const MENU = [
  { href: "/draw-schedule", en: "Draw Schedule", zh: "开彩时间" },
  { href: "/favourites", en: "Favourite Number", zh: "收藏号码" },
  { href: "/number-history", en: "Number History", zh: "开彩记录" },
  { href: "/dabogong", en: "大伯公", zh: "千字图" },
  { href: "/statistics", en: "Hot Numbers", zh: "热门号码" },
];

export default function Header() {
  const [lang] = useLang();
  return (
    <header className="sticky-top navbar-inverse">
      <nav className="navbar navbar-expand-lg navbar-light p-lg-0 py-1" style={{ position: "relative", zIndex: 2 }}>
        <div className="container">
          <a
            data-mkt-home
            href="/"
            /* The logo is the link's only content and is decorative, so the
               link needs its own name - without one a screen reader announced
               "link" and nothing else (measured 14 Oct 2026). */
            aria-label={"MKT 88 4D · " + tr("home", lang)}
            style={{ textDecoration: "none" }}
            onClick={(e) => {
              // Inside the app the logo means "first page" - the tile screen -
              // rather than the website home.
              if (isCapacitorApp()) {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent("mkt-home"));
              }
            }}
          >
            <div className="d-flex flex-column align-items-center mr-2">
              <img src={logo} style={{ height: 48, width: "auto" }} alt="" />
            </div>
          </a>
          <div className="navbar-collapse" id="navbarSupportedContent">
            {/* One rounded group rather than five loose links, so a wrapped row
                on a narrow screen still reads as one bar. */}
            <div
              id="menu-top-menu"
              style={{ marginLeft: "auto", maxWidth: "100%", display: "flex", flexWrap: "nowrap", overflowX: "auto", gap: 2, background: "#fff", border: "1px solid var(--j-border-soft)", borderRadius: 999, padding: 4 }}
            >
              {MENU.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={(event) => {
                    if (!isCapacitorApp()) return;
                    event.preventDefault();
                    window.location.assign(m.href);
                  }}
                  /* English above, the red Chinese label under it: stacked the
                     items are about half as wide, so all five fit the row
                     without spilling past the edge of the page. */
                  /* minHeight 44: these five links are the menu you use all
                     evening, and at 43px they were a pixel under the size a
                     finger is meant to hit comfortably (measured 14 Oct 2026). */
                  style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "5px 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: "var(--j-ink)", textDecoration: "none", whiteSpace: "nowrap", lineHeight: 1.15 }}
                >
                  {m.en}
                  <span style={{ background: "var(--brand)", color: "#ffffff", borderRadius: 6, padding: "1px 6px", marginTop: 3, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{m.zh}</span>
                </Link>
              ))}
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <MonthlyBrowsingTime />
          </div>
        </div>
      </nav>
    </header>
  );
}
