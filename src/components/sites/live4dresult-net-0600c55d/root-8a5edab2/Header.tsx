"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ASSET_BASE } from "./site-paths";
import { isCapacitorApp } from "../../../../lib/is-capacitor-app";

const logo = ASSET_BASE + "/logo-mkt88.webp?v=4";

const REGION_ITEMS = [
  { label: "Sabah Sarawak 4D Results", href: "/sabah-sarawak-4d-results" },
  { label: "Singapore 4D Results", href: "/singapore-4d-results" },
  { label: "Cambodia 4D Results", href: "/cambodia-4d-results" },
];

const LI_BASE =
  "menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children nav-item dropdown";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [regionsOpen, setRegionsOpen] = useState(false);
  const closeAll = () => {
    setMenuOpen(false);
    setRegionsOpen(false);
  };

  return (
    <header className="sticky-top navbar-inverse">
      {/* Above the tap-to-close backdrop below. */}
      <nav className="navbar navbar-expand-lg navbar-light p-lg-0 py-1" style={{ position: "relative", zIndex: 2 }}>
        <div className="container">
          <a
            href="/"
            style={{ textDecoration: "none" }}
            onClick={(e) => {
              closeAll();
              // Inside the app the logo means "first page" - the tile screen -
              // rather than the website home.
              if (isCapacitorApp()) {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent("mkt-home"));
              }
            }}
          >
            {/* Small enough that the logo and the menu button share one line on
                a phone - at 70px the logo filled the row and pushed the button
                onto a second line of its own. */}
            <div className="d-flex flex-column align-items-center mr-2">
              <img src={logo} style={{ height: 48, width: "auto" }} alt="" />
            </div>
          </a>
          {/* Sits at the right end of the logo's line. alignSelf:stretch makes
              this row the logo's height and the button fills it, so the two are
              always the same height whatever the phone font size - the button
              clips its icon instead of growing the row. */}
          <div className="d-flex align-items-center" style={{ marginLeft: "auto", alignSelf: "stretch" }}>
            <button
              className="border-0 navbar-toggler pr-3"
              type="button"
              aria-controls="navbarSupportedContent"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              style={{ minWidth: 48, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
              onClick={() => {
                setMenuOpen((v) => !v);
                setRegionsOpen(false);
              }}
            >
              <small>
                {menuOpen ? (
                  /* The hamburger sat where the open panel covered it, so the
                     menu could not be shut from the button. While it is open
                     the button becomes a clear X in the top right corner. */
                  <span aria-hidden="true" style={{ fontSize: 26, lineHeight: 1, fontWeight: 700, color: "#cc0000" }}>×</span>
                ) : (
                  <span className="navbar-toggler-icon"></span>
                )}
              </small>
            </button>
          </div>
          <div className={"collapse navbar-collapse" + (menuOpen ? " show" : "")} id="navbarSupportedContent">
            <div className="container px-0">
              <div className="menu-top-menu-container">
                <ul id="menu-top-menu" className="navbar-nav">

                  <li
                    className={LI_BASE + " menu-item-13" + (regionsOpen ? " show" : "")}
                  >
                    <a
                      href="#"
                      className="nav-link dropdown-toggle"
                      data-toggle="dropdown"
                      onClick={(e) => {
                        e.preventDefault();
                        setRegionsOpen((v) => !v);
                      }}
                    >
                      Results by Regions
                    </a>
                    <ul className={"sub-menu dropdown-menu" + (regionsOpen ? " show" : "")}>
                      {REGION_ITEMS.map((item, i) => (
                        <li key={item.label} className={LI_BASE + " menu-item-" + (14 + i)}>
                          <Link href={item.href} className="nav-link dropdown-item" onClick={closeAll}>
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>

                  <li className={LI_BASE + " menu-item-18"}>
                    <Link href="/favourites" className="nav-link" onClick={closeAll}>
                      Favourite Number <span style={{ background: "#cc0000", color: "#ffffff", borderRadius: 6, padding: "1px 7px", marginLeft: 4, fontWeight: 700, whiteSpace: "nowrap" }}>收藏号码</span>
                    </Link>
                  </li>
                  <li className={LI_BASE + " menu-item-21"}>
                    <Link href="/draw-schedule" className="nav-link" onClick={closeAll}>
                      Draw Schedule <span style={{ background: "#cc0000", color: "#ffffff", borderRadius: 6, padding: "1px 7px", marginLeft: 4, fontWeight: 700, whiteSpace: "nowrap" }}>
开彩时间
</span>
                    </Link>
                  </li>
                  <li className={LI_BASE + " menu-item-20"}>
                    <Link href="/statistics" className="nav-link" onClick={closeAll}>
                      Hot Numbers <span style={{ background: "#cc0000", color: "#ffffff", borderRadius: 6, padding: "1px 7px", marginLeft: 4, fontWeight: 700, whiteSpace: "nowrap" }}>
热门号码
</span>
                    </Link>
                  </li>
                  <li className={LI_BASE + " menu-item-19"}>
                    <Link href="/dabogong" className="nav-link" onClick={closeAll}>
                      大伯公 <span style={{ background: "#cc0000", color: "#ffffff", borderRadius: 6, padding: "1px 7px", marginLeft: 4, fontWeight: 700, whiteSpace: "nowrap" }}>千字图</span>
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </nav>
      {/* Tapping any blank space closes the menu. This sits under the nav
          (which is lifted above it) so the menu itself stays usable. */}
      {menuOpen ? (
        <div
          onClick={closeAll}
          aria-hidden="true"
          style={{ position: "fixed", inset: 0, zIndex: 1, background: "transparent" }}
        />
      ) : null}
    </header>
  );
}




