"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ALL_SCOPES, FAV_EVENT, SCOPE_LABEL, YELLOW, addFav, isNum, loadFavs, removeFav, saveFavs,
  type Fav, type Scope,
} from "../lib/favourites";

const RED = "#cc0000";

function uniquePerms(digits: string): string[] {
  const set = new Set<string>();
  const chars = [...digits].sort();
  const used = new Array(chars.length).fill(false);
  const cur: string[] = [];
  const walk = () => {
    if (cur.length === chars.length) { set.add(cur.join("")); return; }
    for (let i = 0; i < chars.length; i++) {
      if (used[i]) continue;
      if (i > 0 && chars[i] === chars[i - 1] && !used[i - 1]) continue;
      used[i] = true; cur.push(chars[i]); walk(); cur.pop(); used[i] = false;
    }
  };
  walk();
  return [...set].sort();
}

export default function FavouritesApp() {
  const params = useSearchParams();
  const initial = (params.get("num") || "").replace(/\D/g, "").slice(0, 4);

  const [input, setInput] = useState(initial);
  const [picked, setPicked] = useState<string[]>(initial.length === 4 ? [initial] : []);
  const [scopes, setScopes] = useState<Scope[]>([...ALL_SCOPES]);
  const [notify, setNotify] = useState(false);
  const [favs, setFavs] = useState<Fav[]>([]);
  const [flash, setFlash] = useState("");
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");

  const refresh = useCallback(() => setFavs(loadFavs()), []);

  useEffect(() => {
    refresh();
    const on = () => refresh();
    window.addEventListener(FAV_EVENT, on);
    window.addEventListener("focus", on);
    return () => {
      window.removeEventListener(FAV_EVENT, on);
      window.removeEventListener("focus", on);
    };
  }, [refresh]);

  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  const perms = useMemo(() => (isNum(input) ? uniquePerms(input) : []), [input]);
  const reverseSet = useMemo(() => (isNum(input) ? [...new Set([input, [...input].reverse().join("")])] : []), [input]);

  // When a new valid number is typed, make sure it is selected.
  useEffect(() => {
    if (!isNum(input)) return;
    setPicked((p) => (p.includes(input) ? p : [...p, input]));
  }, [input]);

  const togglePick = (n: string) =>
    setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));

  const selectAll = () => setPicked(perms);
  const clearAll = () => setPicked([]);

  const toggleScope = (s: Scope) =>
    setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const add = () => {
    const list = picked.length ? picked : isNum(input) ? [input] : [];
    const valid = list.filter(isNum);
    if (!valid.length) { setFlash("Enter a 4-digit number first."); return; }
    let next = loadFavs();
    for (const n of valid) next = addFav(n, scopes.length ? scopes : [...ALL_SCOPES], notify);
    setFavs(next);
    setFlash(notify
      ? `Added ${valid.length} number${valid.length === 1 ? "" : "s"} ⭐ — you will be notified when they appear.`
      : `Added ${valid.length} number${valid.length === 1 ? "" : "s"} ⭐ — they will glow yellow when drawn.`);
    window.setTimeout(() => setFlash(""), 5000);
  };

  const askNotify = async () => {
    if (typeof Notification === "undefined") return;
    try {
      const p = await Notification.requestPermission();
      setPerm(p);
      if (p === "granted") {
        setNotify(true);
        setFlash("Notifications enabled 🔔 — tap the bell on a favourite to switch it on.");
        window.setTimeout(() => setFlash(""), 5000);
      }
    } catch { /* ignore */ }
  };

  const toggleBell = (f: Fav) => {
    const next = loadFavs().map((x) => (x.num === f.num ? { ...x, notify: !x.notify } : x));
    saveFavs(next);
    setFavs(next);
  };

  const setScopesFor = (f: Fav, s: Scope) => {
    const cur = f.scopes.includes(s) ? f.scopes.filter((x) => x !== s) : [...f.scopes, s];
    const use = cur.length ? cur : [...ALL_SCOPES];
    const next = loadFavs().map((x) => (x.num === f.num ? { ...x, scopes: use } : x));
    saveFavs(next);
    setFavs(next);
  };

  const del = (n: string) => { setFavs(removeFav(n)); setPicked((p) => p.filter((x) => x !== n)); };

  return (
    <div style={{ minHeight: "100vh", background: "#f4f4f4", fontFamily: "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif", paddingBottom: 70 }}>
      <div className="mkt-app-topbar" style={{ position: "sticky", top: 0, zIndex: 50, background: RED, color: "#fff", display: "flex", alignItems: "center", gap: 6, padding: "10px 8px", boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}>
        <button onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = "/"))}
          style={{ background: "transparent", border: 0, color: "#fff", fontSize: 24, lineHeight: 1, cursor: "pointer", padding: "2px 8px" }} aria-label="Back">←</button>
        <div style={{ flex: 1, textAlign: "center", fontWeight: 800, fontSize: 17, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          Favourite Numbers 收藏号码
        </div>
        <a href="/" style={{ color: "#fff", fontSize: 13, textDecoration: "none", padding: "6px 8px" }}>Home</a>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: 12 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#111" }}>Add favourite numbers 添加收藏号码</div>
          <div style={{ fontSize: 12.5, color: "#666", marginTop: 4 }}>
            Your numbers glow <span style={{ background: YELLOW, padding: "0 4px" }}>yellow</span> on the results and can send a
            special notification the moment they appear.
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input value={input}
              onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="4-digit number"
              inputMode="numeric"
              style={{ flex: 1, minWidth: 0, padding: "10px 12px", border: "1px solid #ccc", borderRadius: 8, fontSize: 20, letterSpacing: 6, textAlign: "center", fontWeight: 800 }} />
            <a href={isNum(input) ? "/number-history?num=" + input : "#"}
              onClick={(e) => { if (!isNum(input)) e.preventDefault(); }}
              style={{ display: "flex", alignItems: "center", flexShrink: 0, whiteSpace: "nowrap", background: "#f2f2f2", color: "#333", border: "1px solid #ddd", borderRadius: 8, padding: "0 12px", fontSize: 13, textDecoration: "none" }}>
              History
            </a>
          </div>

          {perms.length ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  Permutation 排列 (Pau) <span style={{ color: "#999", fontWeight: 400, fontSize: 12 }}>tap to pick</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={selectAll} style={mini("#333")}>Pau 包</button>
                  <button onClick={() => setPicked(reverseSet)} style={mini("#333")}>Reverse 来回</button>
                  <button onClick={clearAll} style={mini("#888")}>Clear</button>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {perms.map((p) => {
                  const on = picked.includes(p);
                  const already = favs.some((f) => f.num === p);
                  return (
                    <button key={p} onClick={() => togglePick(p)}
                      style={{
                        minWidth: 66, padding: "7px 8px", borderRadius: 8, fontSize: 15, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
                        border: on ? "2px solid " + RED : "1px solid #ccc",
                        background: on ? "#ffe9e9" : already ? "#fffbe0" : "#fff",
                        color: "#111",
                      }}>
                      {on ? "✓ " : ""}{p}{already ? " ★" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 12, fontSize: 13, color: "#888" }}>Type a 4-digit number to see all 24 permutations (pau).</div>
          )}

          <div style={{ marginTop: 14, fontWeight: 700, fontSize: 14 }}>Alert for 提醒奖项</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {ALL_SCOPES.map((s) => {
              const on = scopes.includes(s);
              return (
                <button key={s} onClick={() => toggleScope(s)}
                  style={{
                    padding: "6px 12px", borderRadius: 16, cursor: "pointer", fontSize: 13,
                    border: on ? "2px solid " + RED : "1px solid #ccc",
                    background: on ? "#ffe9e9" : "#fff", color: on ? RED : "#333", fontWeight: on ? 700 : 500,
                  }}>
                  {SCOPE_LABEL[s]}
                </button>
              );
            })}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13.5, color: "#333" }}>
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} style={{ width: 18, height: 18 }} />
            Special notification 特别通知 when my number appears
          </label>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={add} style={{ flex: 2, background: RED, color: "#fff", border: 0, borderRadius: 10, padding: "12px 0", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
              Add to favourites
            </button>
            <button onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = "/"))}
              style={{ flex: 1, background: "#fff", color: "#333", border: "1px solid #ccc", borderRadius: 10, padding: "12px 0", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              Back
            </button>
          </div>

          {flash ? <div style={{ marginTop: 10, background: "#e8f5e9", color: "#1b5e20", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>{flash}</div> : null}
        </div>

        <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>My favourite numbers 我的收藏 ({favs.length})</div>
            {favs.length ? (
              <button onClick={() => { saveFavs([]); setFavs([]); }} style={mini(RED)}>Clear all</button>
            ) : null}
          </div>

          {perm !== "granted" ? (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "#fff8e1", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 12.5, color: "#7a5b00" }}>
                {perm === "unsupported" ? "This device will show in-app alerts." : "Allow notifications to get an alert when your number appears."}
              </div>
              {perm !== "unsupported" ? (
                <button onClick={askNotify} style={{ ...mini(RED), whiteSpace: "nowrap" }}>Enable 🔔</button>
              ) : null}
            </div>
          ) : null}

          {favs.length ? (
            <div style={{ marginTop: 10 }}>
              {favs.map((f) => (
                <div key={f.num} style={{ borderTop: "1px solid #f0f0f0", padding: "10px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <a href={"/number-history?num=" + f.num} style={{ textDecoration: "none" }}>
                      <span style={{ display: "inline-block", background: YELLOW, color: "#111", fontWeight: 800, fontSize: 17, letterSpacing: 2, borderRadius: 8, padding: "4px 10px" }}>{f.num}</span>
                    </a>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "#777", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {f.scopes.map((s) => SCOPE_LABEL[s]).join(" · ")}
                      </div>
                      <a href={"/number-history?num=" + f.num} style={{ fontSize: 12, color: RED, textDecoration: "none" }}>Number History →</a>
                    </div>
                    <button onClick={() => toggleBell(f)} title="Special notification"
                      style={{ background: "transparent", border: 0, fontSize: 19, cursor: "pointer", color: f.notify ? "#e6a700" : "#bbb" }}>
                      {f.notify ? "🔔" : "🔕"}
                    </button>
                    <button onClick={() => del(f.num)} title="Remove"
                      style={{ background: "transparent", border: 0, fontSize: 15, cursor: "pointer", color: RED }}>✕</button>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {ALL_SCOPES.map((s) => {
                      const on = f.scopes.includes(s);
                      return (
                        <button key={s} onClick={() => setScopesFor(f, s)}
                          style={{
                            padding: "4px 10px", borderRadius: 14, fontSize: 12, cursor: "pointer",
                            border: on ? "1.5px solid " + RED : "1px solid #ddd",
                            background: on ? "#ffe9e9" : "#fff", color: on ? RED : "#888",
                          }}>
                          {SCOPE_LABEL[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: 10, fontSize: 13, color: "#888" }}>
              No favourites yet. Type a number above and tap <b>Add to favourites</b>.
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", color: "#aaa", fontSize: 11, marginTop: 14 }}>
          Favourites are saved on this device and highlight in <span style={{ background: YELLOW, padding: "0 4px" }}>yellow</span> on all result pages.
        </div>
      </div>
    </div>
  );
}

function mini(color: string): React.CSSProperties {
  return { background: color, color: "#fff", border: 0, borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" };
}
