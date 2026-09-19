"use client";

import { useEffect, useState } from "react";
import { GAME_DEFS, EAST_LINKS } from "./sites/live4dresult-net-0600c55d/root-8a5edab2/GameDefs";
import { isCapacitorApp } from "../lib/is-capacitor-app";

/** Icons cropped from the artwork supplied for the app home screen. */
const HOME = "/sites/live4dresult-net-0600c55d/root-8a5edab2/app-home";
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
  gap: 6, padding: "10px 6px", borderRadius: 14, border: "1px solid #eee", background: "#fff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.07)", textDecoration: "none", color: "#333", textAlign: "center",
};

const ICON_BOX: React.CSSProperties = {
  width: 60, height: 60, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto",
};

function luckyNumber(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

/**
 * The app's first screen: a tile grid of the 11 games plus the shortcuts people
 * actually use, shown when the app opens. Website visitors never see it - it is
 * gated on the Android user agent, so the site stays exactly as it was.
 */
export default function AppHome() {
  const [open, setOpen] = useState(false);
  const [lucky, setLucky] = useState<string | null>(null);

  useEffect(() => {
    if (isCapacitorApp()) setOpen(true);
  }, []);

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
    { href: "/favourites", logo: HOME + "/favourite.png", name: "Favourite Numbers", zh: "收藏号码" },
    { href: "/dabogong", logo: HOME + "/dabogong.png", name: "大伯公", zh: "千字图" },
    // The icon artwork already reads 恭喜发财, so no second Chinese label here.
    { href: "#", logo: HOME + "/gongxi.png", name: "Lucky Numbers", lucky: true },
    { href: PLAY_URL, logo: HOME + "/rate-us.png", name: "Rate us 5 Stars", zh: "给我们五星" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100050, background: "#fff", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "14px 12px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#cc0000" }}>MKT 發發</div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close and see live results"
            style={{ border: 0, background: "#f2f2f2", borderRadius: 10, width: 44, height: 44, fontSize: 22, fontWeight: 800, color: "#cc0000", cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
          {actions.map((t) => (
            <a
              key={t.name}
              href={t.href}
              target={t.href.startsWith("http") ? "_blank" : undefined}
              rel={t.href.startsWith("http") ? "noreferrer" : undefined}
              onClick={(e) => {
                if (t.lucky) { e.preventDefault(); setLucky(luckyNumber()); }
              }}
              style={TILE}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span style={ICON_BOX}><img src={t.logo} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /></span>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#000", lineHeight: 1.15 }}>{t.name}</span>
              {t.zh ? <span style={{ fontSize: 13, fontWeight: 700, color: "#cc0000", lineHeight: 1.15 }}>{t.zh}</span> : null}
            </a>
          ))}
        </div>

        <div style={{ margin: "16px 0 8px", fontSize: 14, fontWeight: 800, color: "#666", letterSpacing: 1 }}>4D RESULTS 开奖成绩</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
          {games.map((t) => (
            <a key={t.name} href={t.href} style={TILE} onClick={() => setOpen(false)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span style={ICON_BOX}><img src={t.logo} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /></span>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#000", lineHeight: 1.15 }}>{t.name}</span>
              {t.zh ? <span style={{ fontSize: 13, color: "#666", lineHeight: 1.15 }}>{t.zh}</span> : null}
            </a>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{ width: "100%", marginTop: 18, padding: "14px 0", border: 0, borderRadius: 12, background: "#cc0000", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer" }}
        >
          See live results 查看成绩
        </button>
      </div>

      {lucky ? (
        <div
          onClick={() => setLucky(null)}
          style={{ position: "fixed", inset: 0, zIndex: 100060, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: "30px 34px", textAlign: "center", maxWidth: 320, width: "88%" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#cc0000" }}>恭喜发财</div>
            <div style={{ fontSize: 15, color: "#888", marginTop: 4 }}>您的幸运号码</div>
            <div style={{ fontSize: 60, fontWeight: 900, letterSpacing: 8, color: "#cc0000", margin: "14px 0 10px", background: "#fff7e6", borderRadius: 12, padding: "8px 0", fontVariantNumeric: "tabular-nums" }}>{lucky}</div>
            <button type="button" onClick={() => setLucky(luckyNumber())} style={{ padding: "10px 18px", background: "#cc0000", color: "#fff", border: 0, borderRadius: 8, marginRight: 8, cursor: "pointer" }}>Try Again</button>
            <button type="button" onClick={() => setLucky(null)} style={{ padding: "10px 18px", background: "#eee", border: 0, borderRadius: 8, cursor: "pointer" }}>Close</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
