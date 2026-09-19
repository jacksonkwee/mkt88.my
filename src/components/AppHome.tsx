"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GAME_DEFS, EAST_LINKS } from "./sites/live4dresult-net-0600c55d/root-8a5edab2/GameDefs";
import { isCapacitorApp } from "../lib/is-capacitor-app";

/** Icons cropped from the artwork supplied for the app home screen. */
const HOME = "/sites/live4dresult-net-0600c55d/root-8a5edab2/app-home";
const LOGO = "/sites/live4dresult-net-0600c55d/root-8a5edab2/logo-mkt88.svg?v=3";
const SG_LOGO = "/sites/live4dresult-net-0600c55d/root-8a5edab2/logo_singapore4d.png";
const PLAY_URL = "https://play.google.com/store/apps/details?id=com.mkt88.app";

/** Same order the swipe strip uses. */
const GAME_ORDER = [
  "magnum", "damacai", "sportstoto", "sg", "grand-dragon", "nine-lotto",
  "sabah88", "sandakan", "cashsweep", "perdana", "lucky-harihari",
];

type Tile = { href: string; logo: string; name: string; zh?: string; lucky?: boolean };

const TILE: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
  gap: 3, padding: "6px 4px", borderRadius: 12, border: "1px solid #eee", background: "#fff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.07)", textDecoration: "none", color: "#333", textAlign: "center",
};

const ICON_BOX: React.CSSProperties = {
  width: "100%", height: 42, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto",
};

const NAME: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: "#000", lineHeight: 1.12 };
const SUB: React.CSSProperties = { fontSize: 10, color: "#666", lineHeight: 1.12 };

function luckyNumber(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

/**
 * Internal links go through next/link so tapping a game is a client-side
 * navigation. A plain <a> reloads the whole page, which re-mounted the root
 * layout and threw the user straight back onto this screen instead of the game
 * they picked.
 */
function Nav({ href, onClick, children }: { href: string; onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void; children: React.ReactNode }) {
  if (href.startsWith("/")) {
    return <Link href={href} style={TILE} onClick={onClick}>{children}</Link>;
  }
  // onClick must be attached here too: the Lucky Numbers tile points at "#",
  // so it takes this branch - and its handler was being dropped, which made the
  // tile do nothing at all.
  return <a href={href} target="_blank" rel="noreferrer" style={TILE} onClick={onClick}>{children}</a>;
}

/** Shown once per app launch, not on every page load. */
const SEEN_KEY = "mkt_app_home_shown";

/**
 * The app's first screen: a tile grid of the 11 games plus the shortcuts people
 * actually use, shown when the app opens. Website visitors never see it - it is
 * gated on the Android user agent, so the site stays exactly as it was.
 */
export default function AppHome() {
  const [open, setOpen] = useState(false);
  const [lucky, setLucky] = useState<string | null>(null);

  useEffect(() => {
    if (!isCapacitorApp()) return;
    // Remember that this launch already showed the home screen. Without it,
    // every page load inside the app re-opened it - so tapping a game looked
    // like the app jumping back to the first page.
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return;
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch { /* private mode - just show it */ }
    setOpen(true);
  }, []);

  // The header logo asks for this screen back, so tapping MKT 發發 on any
  // results page returns to the first page.
  useEffect(() => {
    const onHome = () => setOpen(true);
    window.addEventListener("mkt-home", onHome);
    return () => window.removeEventListener("mkt-home", onHome);
  }, []);

  /**
   * Hide the whole site while the first page is open. It is an overlay, and on
   * phones where the ad banner pads the WebView the fixed layer does not cover
   * that strip - so the results page showed through at the bottom.
   */
  useEffect(() => {
    const site = document.getElementById("mkt-site");
    if (site) site.style.display = open ? "none" : "";
    document.body.style.background = open ? "#fff" : "";
    return () => {
      if (site) site.style.display = "";
      document.body.style.background = "";
    };
  }, [open]);

  if (!open) return null;

  const defs = Object.fromEntries(GAME_DEFS.map((g) => [g.slug, g]));
  const east = Object.fromEntries(EAST_LINKS.map((g) => [g.slug, g]));

  const games: Tile[] = GAME_ORDER.map((slug) => {
    if (slug === "sg") return { href: "/singapore-4d-results", logo: SG_LOGO, name: "Singapore", zh: "新加坡" };
    if (slug === "sandakan") {
      const e = east.stc;
      return { href: e.href, logo: e.logo, name: "Sandakan", zh: e.zh };
    }
    const d = defs[slug];
    if (d) {
      const name = d.name.replace(/\s+4D$/, "");
      return { href: "/result/" + d.slug, logo: d.logo, name, zh: d.zh };
    }
    const e = east[slug];
    if (e) return { href: e.href, logo: e.logo, name: e.name.replace(/\s+4D$/, ""), zh: e.zh };
    return { href: "#", logo: "", name: slug };
  });

  const actions: Tile[] = [
    { href: "/favourites", logo: HOME + "/favourite.png?v=2", name: "Favourite Numbers", zh: "收藏号码" },
    { href: "/dabogong", logo: HOME + "/dabogong.png?v=2", name: "大伯公", zh: "千字图" },
    // The icon artwork already reads 恭喜发财, so no second Chinese label here.
    { href: "#", logo: HOME + "/gongxi.png?v=2", name: "Lucky Numbers", lucky: true },
    { href: PLAY_URL, logo: HOME + "/rate-us.png?v=2", name: "Rate us", zh: "评分" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100050, background: "#fff", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "8px 10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="MKT 發發" style={{ height: 38, width: "auto" }} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close and see live results"
            style={{ border: 0, background: "#f2f2f2", borderRadius: 10, width: 38, height: 38, fontSize: 20, fontWeight: 800, color: "#cc0000", cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        <div style={{ margin: "0 0 5px", fontSize: 12, fontWeight: 800, color: "#666", letterSpacing: 1 }}>4D RESULTS 开奖成绩</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {games.map((t) => (
            <Nav key={t.name} href={t.href} onClick={() => setOpen(false)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span style={ICON_BOX}><img src={t.logo} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /></span>
              <span style={NAME}>{t.name}</span>
              {t.zh ? <span style={SUB}>{t.zh}</span> : null}
            </Nav>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{ width: "100%", margin: "8px 0", padding: "10px 0", border: 0, borderRadius: 10, background: "#cc0000", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
        >
          See live results 查看成绩
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {actions.map((t) => (
            <Nav
              key={t.name}
              href={t.href}
              onClick={(e) => {
                if (t.lucky) {
                  // Same 恭喜发财 popup the three-line menu shows. It lives
                  // here rather than in the header because the header is hidden
                  // behind the first page.
                  e.preventDefault();
                  setLucky(luckyNumber());
                  return;
                }
                // Close the first page as the link opens. Without this the
                // overlay stayed on top and the page it opened showed behind
                // it, which read as the bottom tiles not working at all.
                setOpen(false);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span style={ICON_BOX}><img src={t.logo} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /></span>
              <span style={NAME}>{t.name}</span>
              {t.zh ? <span style={{ ...SUB, fontWeight: 700, color: "#cc0000" }}>{t.zh}</span> : null}
            </Nav>
          ))}
        </div>
      </div>

      {lucky ? (
        <div
          onClick={() => setLucky(null)}
          style={{ position: "fixed", inset: 0, zIndex: 100060, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", textAlign: "center", maxWidth: 320, width: "88%" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#cc0000" }}>恭喜发财</div>
            <div style={{ fontSize: 15, color: "#888", marginTop: 4 }}>您的幸运号码</div>
            <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: 8, color: "#cc0000", margin: "14px 0 10px", background: "#fff7e6", borderRadius: 12, padding: "8px 0", fontVariantNumeric: "tabular-nums" }}>{lucky}</div>
            <button type="button" onClick={() => setLucky(luckyNumber())} style={{ padding: "10px 18px", background: "#cc0000", color: "#fff", border: 0, borderRadius: 8, marginRight: 8, cursor: "pointer" }}>Try Again</button>
            <button type="button" onClick={() => setLucky(null)} style={{ padding: "10px 18px", background: "#eee", border: 0, borderRadius: 8, cursor: "pointer" }}>Close</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
