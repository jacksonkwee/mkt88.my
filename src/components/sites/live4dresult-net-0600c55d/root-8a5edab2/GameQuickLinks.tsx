"use client";

import { useEffect, useRef, useState } from "react";
import { GAME_DEFS, EAST_LINKS } from "./GameDefs";

const SG_LOGO = "/sites/live4dresult-net-0600c55d/root-8a5edab2/logo_singapore4d.png";

// Pager order used by the phone swipe (mirrors GamePager).
const PAGER_ORDER = [
  "magnum", "damacai", "sportstoto", "sg", "grand-dragon", "nine-lotto",
  "sabah88", "sandakan", "cashsweep", "perdana", "lucky-harihari",
];

function Tile({ href, logo, name, zh, active, aRef, onClick, onPointerDown }: { href: string; logo: string; name: string; zh?: string; active?: boolean; aRef?: (el: HTMLAnchorElement | null) => void; onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void; onPointerDown?: (e: React.PointerEvent<HTMLAnchorElement>) => void }) {
  return (
    <a
      ref={aRef}
      href={href}
      onPointerDown={onPointerDown}
      onClick={onClick}
      className="mkt-press"
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
  // Where the finger went down, so a swipe of the icon row is not mistaken for
  // a tap on whichever icon the swipe happened to end over.
  const downAt = useRef<{ x: number; y: number } | null>(null);
  /**
   * On phones every game is already rendered in the swipe track, so tapping a
   * logo switches to that game instantly. Only fall back to a normal link when
   * the track is not on screen (desktop, or a page without the pager).
   */
  const onTileClick = (e: React.MouseEvent<HTMLAnchorElement>, i: number) => {
    const down = downAt.current;
    downAt.current = null;
    // Scrolling the icon row also fires a click on the icon it ends on. Let
    // that do nothing, otherwise the row snaps back and cannot be scrolled.
    if (down && (Math.abs(e.clientX - down.x) > 10 || Math.abs(e.clientY - down.y) > 10)) return;
    const track = document.querySelector(".mkt-pager-track");
    if (!track || track.getClientRects().length === 0) return;
    e.preventDefault();
    setActiveIdx(i);
    window.dispatchEvent(new CustomEvent("mktpager-go", { detail: { index: i } }));
  };
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
  // The row is deliberately never scrolled for you. Centring the active icon
  // used to move the row under the user's finger, and on the phone it left
  // Magnum / Da Ma Cai / Sports Toto parked off screen with no way back.

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
        // flex-start, never center: with 11 icons the row overflows, and a
        // centred flex row hides its left overflow beyond any scrollable
        // range - which is what made Magnum / Da Ma Cai / Sports Toto
        // unreachable on the phone.
        justifyContent: "flex-start",
        padding: "6px 4px 8px",
        background: "#fff",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {items.map((it, i) => (
        <Tile key={i} href={it.href} logo={it.logo} name={it.name} zh={it.zh} active={i === activeIdx} aRef={(el) => { refs.current[i] = el; }} onClick={(e) => onTileClick(e, i)} onPointerDown={(e) => { downAt.current = { x: e.clientX, y: e.clientY }; }} />
      ))}
    </div>
  );
}
