"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FAV_EVENT, YELLOW, loadFavs, toggleFav, type Fav } from "../lib/favourites";

const RED = "#cc0000";

type ApiMatch = { date: string; game: string; logo: string; region: string; prize: string; num: string };
type ApiResp = { nums: string[]; matches: ApiMatch[]; total: number; dbFrom?: string; dbTo?: string; perNum?: Record<string, number> };

const REGIONS = ["M'sia", "Sab, Sar", "Spore", "Others"];
const PRIZES = ["1st", "2nd", "3rd", "Special", "Consolation"];
const PRIZE_COLORS: Record<string, string> = {
  "1st": "#d40000", "2nd": "#0066cc", "3rd": "#008a3e", Special: "#8a4a00", Consolation: "#555",
};
const MAX_ROWS = 400;

function permutationsOf(digits: string): string[] {
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
const reverseOf = (n: string) => [...n].reverse().join("");
const isNum = (v: string) => /^\d{4}$/.test(v);

export default function NumberHistoryApp() {
  const params = useSearchParams();
  const initial = (params.get("num") || "").replace(/\D/g, "").slice(0, 4);

  const [input, setInput] = useState(isNum(initial) ? initial : "");
  const [selected, setSelected] = useState<string[]>(isNum(initial) ? [initial] : []);
  const [mode, setMode] = useState<"single" | "pau" | "reverse" | "custom">("single");
  const [regions, setRegions] = useState<string[]>([]);
  const [prizes, setPrizes] = useState<string[]>([]);
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [favs, setFavs] = useState<Fav[]>([]);
  const mounted = useRef(true);
  const reqId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const refresh = () => setFavs(loadFavs());
    refresh();
    window.addEventListener(FAV_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(FAV_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const primary = isNum(input) ? input : "";
  const perms = useMemo(() => (primary ? permutationsOf(primary) : []), [primary]);
  const reverseSet = useMemo(() => (primary ? [...new Set([primary, reverseOf(primary)])].sort() : []), [primary]);

  const fetchFor = useCallback((nums: string[]) => {
    const list = nums.filter(isNum).slice(0, 60);
    if (!list.length) { setData(null); return; }
    const id = ++reqId.current;
    setLoading(true);
    setErr("");
    fetch("/api/number-history?nums=" + list.join(","), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!mounted.current || id !== reqId.current) return;
        setData(j);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted.current || id !== reqId.current) return;
        setErr("Unable to load history. Please try again.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selected.length) fetchFor(selected);
    else setData(null);
  }, [selected, fetchFor]);

  // Update the visible "mode" to match the current selection.
  useEffect(() => {
    if (!primary) return;
    const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
    if (same(selected, [primary])) setMode("single");
    else if (same(selected, perms)) setMode("pau");
    else if (same(selected, reverseSet)) setMode("reverse");
    else setMode("custom");
  }, [selected, primary, perms, reverseSet]);

  // Load a fresh number: select just that number.
  const pick = (n: string) => { setSelected([n]); setInput(n); };
  const search = () => { if (isNum(input)) { setSelected([input]); fetchFor([input]); } };
  const toggle = (n: string) =>
    setSelected((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.matches;
    if (regions.length) list = list.filter((m) => regions.includes(m.region));
    if (prizes.length) list = list.filter((m) => prizes.includes(m.prize));
    return list;
  }, [data, regions, prizes]);

  const toggleIn = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const isFav = (n: string) => favs.some((f) => f.num === n);
  const onToggleFav = (n: string) => { toggleFav(n); setFavs(loadFavs()); };

  const scopeLine = data
    ? `${data.total} result${data.total === 1 ? "" : "s"} from ${data.nums.length} number${data.nums.length === 1 ? "" : "s"}`
    : "";

  return (
    <div style={{ minHeight: "100vh", background: "#f4f4f4", fontFamily: "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif", paddingBottom: 70 }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: RED, color: "#fff", display: "flex", alignItems: "center", gap: 6, padding: "10px 8px", boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}>
        <button onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = "/"))}
          style={{ background: "transparent", border: 0, color: "#fff", fontSize: 24, lineHeight: 1, cursor: "pointer", padding: "2px 8px" }} aria-label="Back">←</button>
        <div style={{ flex: 1, textAlign: "center", fontWeight: 800, fontSize: 17, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          Number History 开彩记录
        </div>
        <a href="/" style={{ color: "#fff", fontSize: 13, textDecoration: "none", padding: "6px 8px" }}>Home</a>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: 12 }}>
        {/* Search + selection mode */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Search a 4D number</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={input}
              onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="e.g. 1782"
              inputMode="numeric"
              style={{ flex: 1, padding: "10px 12px", border: "1px solid #ccc", borderRadius: 8, fontSize: 20, letterSpacing: 6, textAlign: "center", fontWeight: 800 }} />
            <button onClick={search} style={{ background: RED, color: "#fff", border: 0, borderRadius: 8, padding: "0 18px", fontSize: 15, cursor: "pointer" }}>Search</button>
          </div>

          {primary ? (
            <>
              <div style={{ marginTop: 10, fontWeight: 700, fontSize: 13.5 }}>What to check 查询方式</div>
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <button onClick={() => setSelected([primary])} style={modeBtn(mode === "single")}>Single 单一 {primary}</button>
                <button onClick={() => setSelected(perms)} style={modeBtn(mode === "pau")}>Pau 包 (all {perms.length})</button>
                <button onClick={() => setSelected(reverseSet)} style={modeBtn(mode === "reverse")}>
                  Reverse 来回 {reverseSet.join(" / ")}
                </button>
              </div>
              <div style={{ marginTop: 10, fontSize: 12.5, color: "#555" }}>
                Selected <b>{selected.length}</b>: {selected.slice(0, 12).join(", ")}{selected.length > 12 ? " …" : ""}
              </div>
            </>
          ) : null}

          {data ? (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, color: "#555" }}>
                {scopeLine}
                {data.dbFrom ? <span style={{ color: "#999" }}> (records {data.dbFrom} → {data.dbTo})</span> : null}
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button onClick={() => onToggleFav(primary || data.nums[0])}
                  style={{ border: "1px solid " + RED, borderRadius: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: isFav(primary || data.nums[0]) ? YELLOW : "#fff", color: isFav(primary || data.nums[0]) ? "#111" : RED }}>
                  {isFav(primary || data.nums[0]) ? "★ Favourite" : "☆ Add favourite"}
                </button>
                <a href={"/favourites?num=" + (primary || data.nums[0])}
                  style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 700, color: "#333", textDecoration: "none", background: "#fff" }}>
                  ⭐ Pau / Notify
                </a>
              </div>
            </div>
          ) : null}
        </div>

        {/* Permutation picker */}
        {perms.length ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                Permutation 排列 (Pau) <span style={{ color: "#999", fontWeight: 400, fontSize: 12 }}>— tap to pick any</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setSelected(perms)} style={mini("#333")}>All</button>
                <button onClick={() => setSelected([primary])} style={mini("#888")}>Clear</button>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {perms.map((p) => {
                const on = selected.includes(p);
                const fav = isFav(p);
                return (
                  <button key={p} onClick={() => toggle(p)}
                    style={{
                      minWidth: 66, padding: "7px 8px", borderRadius: 8, fontSize: 15, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
                      border: on ? "2px solid " + RED : "1px solid #ccc",
                      background: fav ? YELLOW : on ? "#ffe9e9" : "#fff", color: "#111",
                    }}>
                    {on ? "✓ " : ""}{p}{fav ? " ★" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Filters (multi-select) */}
        {data ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Region 地区 {regions.length ? <span style={{ color: RED }}>({regions.length})</span> : null}</div>
              <button onClick={() => setRegions([])} style={mini(regions.length ? RED : "#bbb")}>All</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, marginBottom: 12 }}>
              {REGIONS.map((r) => (
                <button key={r} onClick={() => toggleIn(regions, setRegions, r)} style={chip(regions.includes(r))}>{r}</button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Prize 奖项 {prizes.length ? <span style={{ color: RED }}>({prizes.length})</span> : null}</div>
              <button onClick={() => setPrizes([])} style={mini(prizes.length ? RED : "#bbb")}>All</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {PRIZES.map((p) => (
                <button key={p} onClick={() => toggleIn(prizes, setPrizes, p)} style={chip(prizes.includes(p))}>{p}</button>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 11.5, color: "#999" }}>Tip: you can pick more than one region and more than one prize.</div>
          </div>
        ) : null}

        {/* Results */}
        {selected.length ? (
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: 30, textAlign: "center", color: "#777" }}>Searching past results…</div>
            ) : err ? (
              <div style={{ padding: 30, textAlign: "center", color: RED }}>{err}</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#777" }}>
                No past draw found for the selected number{selected.length === 1 ? "" : "s"}.
                <div style={{ fontSize: 12, marginTop: 6, color: "#aaa" }}>Try another number or clear the filters.</div>
              </div>
            ) : (
              <div>
                <div style={{ padding: "10px 12px", borderBottom: "1px solid #eee", fontSize: 13, color: "#777" }}>
                  Showing {Math.min(filtered.length, MAX_ROWS)} of {filtered.length} result{filtered.length === 1 ? "" : "s"}
                  {regions.length ? " · " + regions.join(" + ") : ""}
                  {prizes.length ? " · " + prizes.join(" + ") : ""}
                </div>
                {filtered.slice(0, MAX_ROWS).map((m, i) => {
                  const fav = isFav(m.num);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: "1px solid #f0f0f0", background: fav ? YELLOW : "#fff" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid #e6e6e6", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#fff", flexShrink: 0 }}>
                        {m.logo ? <img src={m.logo} alt="" style={{ maxWidth: 30, maxHeight: 30 }} /> : <span style={{ fontSize: 10, color: "#999" }}>4D</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.game}</div>
                        <div style={{ fontSize: 12, color: "#888" }}>{m.date} · {m.region}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, color: "#fff", background: PRIZE_COLORS[m.prize] || "#777", borderRadius: 6, padding: "2px 7px", marginBottom: 3 }}>
                          {m.prize}
                        </span>
                        <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: 2 }}>{m.num}</div>
                      </div>
                      <button onClick={() => onToggleFav(m.num)} title="Favourite"
                        style={{ background: "transparent", border: 0, fontSize: 18, cursor: "pointer", padding: 4, color: fav ? "#e6a700" : "#bbb" }}>
                        {fav ? "★" : "☆"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, padding: 30, textAlign: "center", color: "#888", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
            Type a 4-digit number above to see every draw where it appeared.
          </div>
        )}

        <div style={{ textAlign: "center", color: "#aaa", fontSize: 11, marginTop: 16 }}>
          Pau 包 shows every permutation · Reverse 来回 shows the number and its reverse.
        </div>
      </div>
    </div>
  );
}

function modeBtn(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px", borderRadius: 16, fontSize: 13, fontWeight: active ? 700 : 500, cursor: "pointer",
    border: active ? "2px solid " + RED : "1px solid #ccc", background: active ? "#ffe9e9" : "#fff", color: active ? RED : "#333",
  };
}
function chip(active: boolean): React.CSSProperties {
  return {
    padding: "5px 12px", borderRadius: 16, fontSize: 13, cursor: "pointer",
    border: active ? "2px solid " + RED : "1px solid #ccc",
    background: active ? "#ffe9e9" : "#fff", color: active ? RED : "#333", fontWeight: active ? 700 : 500,
  };
}
function mini(color: string): React.CSSProperties {
  return { background: color, color: "#fff", border: 0, borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 700 };
}
