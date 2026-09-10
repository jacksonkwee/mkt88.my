"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  FAV_EVENT, YELLOW, addFav, cellScope, isNum, loadFavs, removeFav,
  type Fav,
} from "../lib/favourites";

const RED = "#cc0000";
const HIDDEN = ["/admin", "/past-results", "/number-history", "/favourites", "/disclaimer", "/privacy-policy", "/api"];

function prizeLabel(el: Element | null): string {
  const id = (el && el.getAttribute && el.getAttribute("data-id")) || "";
  if (id === "first_prize") return "1st Prize 首奖";
  if (id === "second_prize") return "2nd Prize 二奖";
  if (id === "third_prize") return "3rd Prize 三奖";
  if (id.startsWith("special-")) return "Special 特别奖";
  if (id.startsWith("consolation-")) return "Consolation 安慰奖";
  return "Result";
}

function gameName(el: Element | null): string {
  const card = el && el.closest ? el.closest(".card") : null;
  const n = card && card.querySelector(".lottery-name");
  return n && n.textContent ? n.textContent.replace(/\s+/g, " ").trim() : "4D Result";
}

export default function AppTools() {
  const path = usePathname() || "";
  const hidden = HIDDEN.some((h) => path === h || path.startsWith(h + "/"));
  const [open, setOpen] = useState(false);
  const [favs, setFavs] = useState<Fav[]>([]);
  const [input, setInput] = useState("");
  const [toast, setToast] = useState<{ num: string; game: string; prize: string } | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    setFavs(loadFavs());
    const on = () => setFavs(loadFavs());
    window.addEventListener(FAV_EVENT, on);
    window.addEventListener("storage", on);
    window.addEventListener("focus", on);
    return () => {
      window.removeEventListener(FAV_EVENT, on);
      window.removeEventListener("storage", on);
      window.removeEventListener("focus", on);
    };
  }, []);

  const add = () => {
    const v = input.trim();
    if (!isNum(v)) return;
    setFavs(addFav(v, ["main", "special", "consolation"]));
    setInput("");
  };

  // Tap a result number -> open its Number History page.
  useEffect(() => {
    if (hidden) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || !t.closest) return;
      if (t.closest("#mkt-tools, #mkt-toast")) return;
      const cell = t.closest(".lottery-number, .lottery-prize-number") as HTMLElement | null;
      if (!cell || cell.closest("a")) return;
      const num = (cell.textContent || "").replace(/\s+/g, "");
      if (isNum(num)) window.location.href = "/number-history?num=" + num;
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [hidden]);

  // Highlight favourite numbers (yellow) and raise a special notification.
  useEffect(() => {
    if (hidden) return;
    const paint = () => {
      const cells = document.querySelectorAll(".lottery-number, .lottery-prize-number");
      const present = new Set<string>();
      for (const c of cells) {
        const el = c as HTMLElement;
        const v = (el.textContent || "").replace(/\s+/g, "");
        if (!isNum(v)) continue;
        const scope = cellScope(el);
        const match = favs.find((f) => f.num === v && f.scopes.indexOf(scope) >= 0);
        const ours = el.getAttribute("data-mkt-fav") === "1";
        if (match) {
          el.style.backgroundColor = YELLOW;
          el.style.boxShadow = "0 0 0 2px #e6a700 inset";
          el.setAttribute("data-mkt-fav", "1");
          if (match.notify) {
            const card = el.closest(".card");
            const key = v + "|" + (card && card.id ? card.id : scope);
            present.add(key);
            if (!seen.current.has(key)) {
              seen.current.add(key);
              notify(v, gameName(el), prizeLabel(el));
            }
          }
        } else if (ours) {
          el.style.backgroundColor = "";
          el.style.boxShadow = "";
          el.removeAttribute("data-mkt-fav");
        }
      }
      // Forget numbers that are no longer on screen so a future draw can alert again.
      for (const k of [...seen.current]) {
        const num = k.split("|")[0];
        const stillOnPage = [...cells].some((c) => ((c.textContent || "").replace(/\s+/g, "") === num));
        if (!stillOnPage) seen.current.delete(k);
      }
    };
    paint();
    const timer = window.setInterval(paint, 1200);
    return () => window.clearInterval(timer);
  }, [hidden, favs]);

  const notify = (num: string, game: string, prize: string) => {
    setToast({ num, game, prize });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 9000);
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("⭐ " + num + " appeared!", { body: game + " · " + prize, icon: "/sites/live4dresult-net-0600c55d/root-8a5edab2/icon_192x192.png" });
      }
    } catch { /* ignore */ }
  };

  if (hidden) return null;

  return (
    <>
      {toast ? (
        <div id="mkt-toast"
          onClick={() => { setToast(null); window.location.href = "/number-history?num=" + toast.num; }}
          style={{
            position: "fixed", left: 12, bottom: 76, zIndex: 9991, background: "#fff", border: "2px solid " + RED,
            borderLeft: "8px solid " + YELLOW, borderRadius: 12, padding: "10px 14px", boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
            cursor: "pointer", maxWidth: 280, fontFamily: "sans-serif",
          }}>
          <div style={{ fontSize: 12, color: RED, fontWeight: 800 }}>⭐ FAVOURITE NUMBER APPEARED</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 3, margin: "2px 0" }}>{toast.num}</div>
          <div style={{ fontSize: 12, color: "#555" }}>{toast.game}</div>
          <div style={{ fontSize: 12, color: "#777" }}>{toast.prize} · tap to see history</div>
        </div>
      ) : null}

      <div id="mkt-tools" style={{ position: "fixed", right: 12, bottom: 12, zIndex: 9990 }}>
        {open ? (
          <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 12, padding: 12, width: 240, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", fontFamily: "sans-serif" }}>
            <div style={{ fontWeight: 800, marginBottom: 6, color: "#111" }}>Favourite Numbers ⭐</div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
              Tap any result number for its <b>Number History</b>. Favourites glow <span style={{ background: YELLOW, padding: "0 4px" }}>yellow</span> when drawn.
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              <input value={input} onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder="4-digit number"
                style={{ flex: 1, padding: 6, border: "1px solid #ccc", borderRadius: 6, letterSpacing: 2, fontSize: 15 }} inputMode="numeric" />
              <button onClick={add} style={{ background: RED, color: "#fff", border: 0, borderRadius: 6, padding: "0 10px", cursor: "pointer" }}>Add</button>
            </div>
            <a href="/favourites" style={{ display: "block", textAlign: "center", background: "#ffe9e9", color: RED, borderRadius: 8, padding: "8px 0", fontWeight: 700, fontSize: 13, textDecoration: "none", marginBottom: 8 }}>
              ＋ Add favourite numbers (pau / notification)
            </a>
            {favs.length ? (
              <div style={{ maxHeight: 170, overflowY: "auto" }}>
                {favs.map((f) => (
                  <div key={f.num} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>
                    <b style={{ fontSize: 15, background: YELLOW, borderRadius: 6, padding: "1px 6px" }}>{f.num}</b>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <a href={"/number-history?num=" + f.num} style={{ color: RED, fontSize: 12, textDecoration: "none" }}>History</a>
                      <button onClick={() => setFavs(removeFav(f.num))} style={{ border: 0, background: "none", color: RED, cursor: "pointer", fontSize: 14 }}>✕</button>
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
    </>
  );
}

