"use client";

import { useEffect, useRef, useState } from "react";
import { GAME_DEFS, EAST_LINKS } from "./GameDefs";

const SG_LOGO = "/sites/live4dresult-net-0600c55d/root-8a5edab2/logo_singapore4d.png";

// Pager order used by the phone swipe (mirrors GamePager).
const PAGER_ORDER = [
  "magnum", "damacai", "sportstoto", "sg", "grand-dragon", "nine-lotto",
  "sabah88", "sandakan", "cashsweep", "perdana", "lucky-harihari",
];

function Tile({ href, logo, name, zh, active, aRef }: { href: string; logo: string; name: string; zh?: string; active?: boolean; aRef?: (el: HTMLAnchorElement | null) => void }) {
  return (
    <a
      ref={aRef}
      href={href}
      title={name}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
        width: 68,
        boxSizing: "border-box",
        padding: "6px 2px",
        border: "1px solid #eee",
        borderRadius: 10,
        background: active ? "#e6e6e6" : "#fff",
        color: "#333",
        textDecoration: "none",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt={name} style={{ width: 44, height: 44, objectFit: "contain", marginBottom: 4 }} />
      <span style={{ fontSize: 10, fontWeight: active ? 800 : 700, textAlign: "center", lineHeight: 1.15, whiteSpace: "normal" }}>{name}</span>
      {zh ? <span style={{ fontSize: 9, color: "#666", textAlign: "center" }}>{zh}</span> : null}
    </a>
  );
}

export default function GameQuickLinks() {
  const [activeIdx, setActiveIdx] = useState(-1);
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  // Highlight the icon that matches the page you are on (web/desktop too).
  useEffect(() => {
    const p = window.location.pathname;
    const q = window.location.search;
    let idx = -1;
    const rm = /^\/result\/([^/?#]+)/.exec(p);
    if (rm) idx = PAGER_ORDER.indexOf(rm[1]);
    else if (p === "/singapore-4d-results") idx = PAGER_ORDER.indexOf("sg");
    else if (p === "/sabah-sarawak-4d-results") {
      const op = new URLSearchParams(q).get("op");
      if (op === "sandakan") idx = PAGER_ORDER.indexOf("sandakan");
      else if (op === "sabah88") idx = PAGER_ORDER.indexOf("sabah88");
      else if (op === "cashsweep") idx = PAGER_ORDER.indexOf("cashsweep");
    }
    if (idx >= 0) setActiveIdx(idx);
  }, []);

  useEffect(() => {
    const onPager = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d && typeof d.index === "number") setActiveIdx(d.index);
    };
    window.addEventListener("mktpager", onPager);
    return () => window.removeEventListener("mktpager", onPager);
  }, []);
  useEffect(() => {
    const el = refs.current[activeIdx];
    if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeIdx]);

  const defsBySlug: Record<string, (typeof GAME_DEFS)[number]> = Object.fromEntries(GAME_DEFS.map((g) => [g.slug, g]));
  const eastBySlug: Record<string, (typeof EAST_LINKS)[number]> = Object.fromEntries(EAST_LINKS.map((g) => [g.slug, g]));

  const items: { href: string; logo: string; name: string; zh?: string }[] = PAGER_ORDER.map((slug) => {
    if (slug === "sg") return { href: "/singapore-4d-results", logo: SG_LOGO, name: "Singapore 4D", zh: "新加坡" };
    if (slug === "sandakan") {
      const e = eastBySlug.stc;
      return { href: e.href, logo: e.logo, name: e.name, zh: e.zh };
    }
    const d = defsBySlug[slug];
    if (d) return { href: "/result/" + d.slug, logo: d.logo, name: d.name, zh: d.zh };
    const e = eastBySlug[slug];
    if (e) return { href: e.href, logo: e.logo, name: e.name, zh: e.zh };
    return { href: "#", logo: "", name: slug };
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        overflowX: "auto",
        overflowY: "hidden",
        justifyContent: "safe center",
        padding: "6px 4px 8px",
        background: "#fff",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {items.map((it, i) => (
        <Tile key={i} href={it.href} logo={it.logo} name={it.name} zh={it.zh} active={i === activeIdx} aRef={(el) => { refs.current[i] = el; }} />
      ))}
    </div>
  );
}
