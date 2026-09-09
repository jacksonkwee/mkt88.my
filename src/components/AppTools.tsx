"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const LS = "mkt_favs_v1";
const YELLOW = "rgb(255, 232, 76)";
const RED = "#cc0000";

const HIDDEN = ["/admin", "/past-results", "/number-history", "/disclaimer", "/privacy-policy", "/api"];

export default function AppTools() {
  const path = usePathname() || "";
  const hidden = HIDDEN.some((h) => path === h || path.startsWith(h + "/"));
  const [open, setOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS);
      if (raw) setFavorites(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const save = (list: string[]) => {
    setFavorites(list);
    try { localStorage.setItem(LS, JSON.stringify(list)); } catch { /* ignore */ }
  };

  const add = () => {
    const v = input.trim();
    if (/^\d{4}$/.test(v) && !favorites.includes(v)) save([...favorites, v]);
    setInput("");
  };

  // Tap a result number -> open its Number History page.
  useEffect(() => {
    if (hidden) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || !t.closest) return;
      if (t.closest("#mkt-tools")) return;
      const cell = t.closest(".lottery-number, .lottery-prize-number") as HTMLElement | null;
      if (!cell) return;
      if (cell.closest("a")) return;
      const num = (cell.textContent || "").replace(/\s+/g, "");
      if (/^\d{4}$/.test(num)) window.location.href = "/number-history?num=" + num;
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [hidden]);

  // Yellow highlight for favourite numbers shown on result cards.
  useEffect(() => {
    if (hidden) return;
    const paint = () => {
      const cells = document.querySelectorAll(".lottery-number, .lottery-prize-number");
      for (const c of cells) {
        const el = c as HTMLElement;
        const v = (el.textContent || "").replace(/\s+/g, "");
        if (!/^\d{4}$/.test(v)) continue;
        if (favorites.includes(v)) el.style.backgroundColor = YELLOW;
        else if (el.style.backgroundColor) {
          const bg = el.style.backgroundColor;
          if (bg === YELLOW || bg === "#ffe84c" || bg.toLowerCase().includes("ffe84c")) el.style.backgroundColor = "";
        }
      }
    };
    paint();
    const timer = window.setInterval(paint, 1200);
    return () => window.clearInterval(timer);
  }, [hidden, favorites]);

  if (hidden) return null;

  return (
    <div id="mkt-tools" style={{ position: "fixed", right: 12, bottom: 12, zIndex: 9990 }}>
      {open ? (
        <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 12, padding: 12, width: 230, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", fontFamily: "sans-serif" }}>
          <div style={{ fontWeight: 800, marginBottom: 8, color: "#111" }}>Favourite Numbers ⭐</div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
            Tap a result number to open its <b>Number History</b>. Favourites glow <span style={{ background: YELLOW, padding: "0 4px" }}>yellow</span> when drawn.
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            <input value={input} onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="4-digit number"
              style={{ flex: 1, padding: 6, border: "1px solid #ccc", borderRadius: 6, letterSpacing: 2, fontSize: 15 }} inputMode="numeric" />
            <button onClick={add} style={{ background: RED, color: "#fff", border: 0, borderRadius: 6, padding: "0 10px", cursor: "pointer" }}>Add</button>
          </div>
          {favorites.length ? (
            <div style={{ maxHeight: 180, overflowY: "auto" }}>
              {favorites.map((f) => (
                <div key={f} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <b style={{ fontSize: 15 }}>{f}</b>
                  <span>
                    <a href={"/number-history?num=" + f} style={{ color: RED, fontSize: 12, marginRight: 8, textDecoration: "none" }}>History</a>
                    <button onClick={() => save(favorites.filter((x) => x !== f))} style={{ border: 0, background: "none", color: RED, cursor: "pointer", fontSize: 14 }}>✕</button>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#777", fontSize: 12 }}>No favourites yet. Add a 4-digit number to get a yellow highlight when it appears.</div>
          )}
        </div>
      ) : null}
      <button onClick={() => setOpen((v) => !v)} aria-label="Favourite numbers"
        style={{ width: 48, height: 48, borderRadius: 24, background: RED, color: "#fff", border: 0, fontSize: 26, lineHeight: 1, boxShadow: "0 2px 8px rgba(0,0,0,0.3)", cursor: "pointer" }}>+</button>
    </div>
  );
}
