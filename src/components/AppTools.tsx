"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { FAV_EVENT, YELLOW, cellScope, isNum, loadFavs, type Fav } from "../lib/favourites";

const RED = "#cc0000";
const HIDDEN = ["/admin", "/past-results", "/favourites", "/disclaimer", "/privacy-policy", "/api"];

function prizeLabel(el: Element | null): string {
  const id = (el && el.getAttribute && el.getAttribute("data-id")) || "";
  if (id === "first_prize") return "1st Prize 首奖";
  if (id === "second_prize") return "2nd Prize 二奖";
  if (id === "third_prize") return "3rd Prize 三奖";
  if (id.indexOf("special-") === 0) return "Special 特别奖";
  if (id.indexOf("consolation-") === 0) return "Consolation 安慰奖";
  return "Result";
}

function gameName(el: Element | null): string {
  const card = el && el.closest ? el.closest(".card") : null;
  const n = card && card.querySelector(".lottery-name");
  return n && n.textContent ? n.textContent.replace(/\s+/g, " ").trim() : "4D Result";
}

/**
 * Behaviour-only helper (no on-screen button):
 *  - tapping a result number opens its Number History page
 *  - favourite numbers glow yellow on the result cards
 *  - favourite numbers raise an alert when they appear
 * Favourite numbers are added / removed from the "Favourite Number 收藏号码"
 * item in the top menu.
 */
export default function AppTools() {
  const path = usePathname() || "";
  const hidden = HIDDEN.some((h) => path === h || path.startsWith(h + "/"));
  const [favs, setFavs] = useState<Fav[]>([]);
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

  // Tap a result number -> open its Number History page.
  useEffect(() => {
    if (hidden) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || !t.closest) return;
      if (t.closest("#mkt-toast")) return;
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
      // Forget numbers that left the screen so a future draw can alert again.
      for (const k of [...seen.current]) {
        const num = k.split("|")[0];
        const stillOnPage = [...cells].some((c) => (c.textContent || "").replace(/\s+/g, "") === num);
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

  if (hidden || !toast) return null;

  return (
    <div id="mkt-toast"
      onClick={() => { const n = toast.num; setToast(null); window.location.href = "/number-history?num=" + n; }}
      style={{
        position: "fixed", left: 12, bottom: 12, zIndex: 9991, background: "#fff", border: "2px solid " + RED,
        borderLeft: "8px solid " + YELLOW, borderRadius: 12, padding: "10px 14px", boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
        cursor: "pointer", maxWidth: 280, fontFamily: "sans-serif",
      }}>
      <div style={{ fontSize: 12, color: RED, fontWeight: 800 }}>⭐ FAVOURITE NUMBER APPEARED</div>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 3, margin: "2px 0" }}>{toast.num}</div>
      <div style={{ fontSize: 12, color: "#555" }}>{toast.game}</div>
      <div style={{ fontSize: 12, color: "#777" }}>{toast.prize} · tap to see history</div>
    </div>
  );
}
