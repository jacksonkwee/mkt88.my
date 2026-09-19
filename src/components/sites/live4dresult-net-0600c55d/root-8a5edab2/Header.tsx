"use client";

import { useEffect, useState } from "react";
import { ASSET_BASE } from "./site-paths";
import { isCapacitorApp } from "../../../../lib/is-capacitor-app";

const logo = ASSET_BASE + "/logo-mkt88.svg?v=3";

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
  const [luckyOpen, setLuckyOpen] = useState(false);
  const [luckyNum, setLuckyNum] = useState("0000");
  const closeAll = () => {
    setMenuOpen(false);
    setRegionsOpen(false);
  };
  const lucky = () => {
    setLuckyNum(String(Math.floor(Math.random() * 10000)).padStart(4, "0"));
    setLuckyOpen(true);
  };

  // The app home screen's Lucky Numbers tile opens this same 恭喜发财 dialog,
  // so there is one implementation rather than two.
  useEffect(() => {
    const onLucky = () => {
      setLuckyNum(String(Math.floor(Math.random() * 10000)).padStart(4, "0"));
      setLuckyOpen(true);
    };
    window.addEventListener("mkt-lucky", onLucky);
    return () => window.removeEventListener("mkt-lucky", onLucky);
  }, []);

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
                          <a href={item.href} className="nav-link dropdown-item" onClick={closeAll}>
                            {item.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </li>

                  <li className={LI_BASE + " menu-item-18"}>
                    <a href="/favourites" className="nav-link" onClick={closeAll}>
                      Favourite Number <span style={{ background: "#cc0000", color: "#ffffff", borderRadius: 6, padding: "1px 7px", marginLeft: 4, fontWeight: 700, whiteSpace: "nowrap" }}>收藏号码</span>
                    </a>
                  </li>
                  <li className={LI_BASE + " menu-item-19"}>
                    <a href="/dabogong" className="nav-link" onClick={closeAll}>
                      大伯公 <span style={{ background: "#cc0000", color: "#ffffff", borderRadius: 6, padding: "1px 7px", marginLeft: 4, fontWeight: 700, whiteSpace: "nowrap" }}>千字图</span>
                    </a>
                  </li>
                  <li className="menu-item menu-item-type-custom menu-item-object-custom current-menu-item current_page_item menu-item-home menu-item-12 nav-item dropdown">
                    <a
                      href="#"
                      className="nav-link fx-gongxi"
                      style={{ cursor: "pointer" }}
                      onClick={(e) => {
                        e.preventDefault();
                        closeAll();
                        lucky();
                      }}
                    >
                      <i className="fa fa-hand-pointer" aria-hidden="true" style={{ color: "#ffd700", marginRight: 8, fontSize: "0.8em" }}></i>
                      恭喜发财
                    </a>
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
      {luckyOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100000,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setLuckyOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "34px 40px",
              textAlign: "center",
              boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
              maxWidth: 320,
              width: "90%",
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 800, color: "#cc0000" }}>恭喜发财</div>
            <div style={{ fontSize: 15, color: "#888", marginTop: 4 }}>您的幸运号码</div>
            <div
              style={{
                fontSize: 64,
                fontWeight: 900,
                letterSpacing: 8,
                color: "#cc0000",
                margin: "16px 0 10px",
                background: "#fff7e6",
                borderRadius: 12,
                padding: "10px 0",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {luckyNum}
            </div>
            <button
              onClick={() => lucky()}
              style={{
                padding: "10px 18px",
                background: "#cc0000",
                color: "#fff",
                border: 0,
                borderRadius: 8,
                marginRight: 8,
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => setLuckyOpen(false)}
              style={{ padding: "10px 18px", background: "#eee", border: 0, borderRadius: 8, cursor: "pointer" }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}




