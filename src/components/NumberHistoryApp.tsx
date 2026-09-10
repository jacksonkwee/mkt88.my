"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FAV_EVENT, YELLOW, loadFavs, toggleFav, type Fav } from "../lib/favourites";

const RED = "#cc0000";

type ApiMatch = {
  date: string;
  game: string;
  logo: string;
  region: string;
  prize: string;
  num: string;
};
type ApiResp = { num: string; matches: ApiMatch[]; total: number; dbFrom?: string; dbTo?: string };

const REGIONS = ["All", "M'sia", "Sab, Sar", "Spore", "Others"] as const;
const PRIZES = ["All", "1st", "2nd", "3rd", "Special", "Consolation"] as const;

const PRIZE_COLORS: Record<string, string> = {
  "1st": "#d40000",
  "2nd": "#0066cc",
  "3rd": "#008a3e",
  Special: "#8a4a00",
  Consolation: "#555",
};

function uniquePerms(digits: string): string[] {
  const set = new Set<string>();
  const n = digits.length;
  const used = new Array(n).fill(false);
  const cur: string[] = [];
  const chars = [...digits].sort();
  const walk = () => {
    if (cur.length === n) {
      set.add(cur.join(""));
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      if (i > 0 && chars[i] === chars[i - 1] && !used[i - 1]) continue;
      used[i] = true;
      cur.push(chars[i]);
      walk();
      cur.pop();
      used[i] = false;
    }
  };
  walk();
  return [...set].sort();
}

export default function NumberHistoryApp() {
  const params = useSearchParams();
  const initial = (params.get("num") || "").trim();

  const [num, setNum] = useState(/^\d{4}$/.test(initial) ? initial : "");
  const [input, setInput] = useState(num);
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [region, setRegion] = useState<string>("All");
  const [prize, setPrize] = useState<string>("All");
  const [favs, setFavs] = useState<Fav[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
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

  const go = useCallback((n: string) => {
    if (!/^\d{4}$/.test(n)) return;
    setNum(n);
    setInput(n);
    setLoading(true);
    setErr("");
    fetch("/api/number-history?num=" + n, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!mounted.current) return;
        setData(j);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted.current) return;
        setErr("Unable to load history. Please try again.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (num) go(num);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const perms = useMemo(() => (num ? uniquePerms(num) : []), [num]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.matches;
    if (region !== "All") list = list.filter((m) => m.region === region);
    if (prize !== "All") list = list.filter((m) => m.prize === prize);
    return list;
  }, [data, region, prize]);

  const isFav = (n: string) => favs.some((f) => f.num === n);
  const onToggleFav = (n: string) => { toggleFav(n); setFavs(loadFavs()); };

  const search = () => {
    const v = input.trim();
    if (/^\d{4}$/.test(v)) go(v);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f4f4f4", fontFamily: "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif", paddingBottom: 60 }}>
      {/* App header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: RED, color: "#fff", display: "flex", alignItems: "center", padding: "10px 8px", gap: 6, boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}>
        <button onClick={() => { if (window.history.length > 1) window.history.back(); else window.location.href = "/"; }}
          style={{ background: "transparent", border: 0, color: "#fff", fontSize: 24, lineHeight: 1, cursor: "pointer", padding: "2px 8px" }} aria-label="Back">←</button>
        <div style={{ flex: 1, textAlign: "center", fontWeight: 800, fontSize: 17, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          Number History 开彩记录
        </div>
        <button onClick={() => { window.location.href = "/"; }}
          style={{ background: "transparent", border: 0, color: "#fff", fontSize: 13, cursor: "pointer", padding: "6px 8px", whiteSpace: "nowrap" }}>Home</button>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: 12 }}>
        {/* Search */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Search a 4D number</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="e.g. 2609"
              inputMode="numeric"
              style={{ flex: 1, padding: "10px 12px", border: "1px solid #ccc", borderRadius: 8, fontSize: 20, letterSpacing: 6, textAlign: "center", fontWeight: 800 }}
            />
            <button onClick={search} style={{ background: RED, color: "#fff", border: 0, borderRadius: 8, padding: "0 18px", fontSize: 15, cursor: "pointer" }}>Search</button>
          </div>
          {num ? (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, color: "#555" }}>
                <b style={{ fontSize: 18, color: "#111" }}>{num}</b> — {data ? `${data.total} past draw${data.total === 1 ? "" : "s"}` : "…"} found
                {data && data.dbFrom ? <span style={{ color: "#999" }}> (records {data.dbFrom} → {data.dbTo})</span> : null}
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button onClick={() => onToggleFav(num)}
                  style={{
                    border: "1px solid " + RED, borderRadius: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                    background: isFav(num) ? YELLOW : "#fff", color: isFav(num) ? "#111" : RED,
                  }}>
                  {isFav(num) ? "★ Favourite" : "☆ Add favourite"}
                </button>
                <a href={"/favourites?num=" + num}
                  style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 700, color: "#333", textDecoration: "none", background: "#fff" }}>
                  ⭐ Pau / Notify
                </a>
              </div>
            </div>
          ) : null}
        </div>

        {/* Permutation */}
        {perms.length ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
              Permutation 排列 (Pau) <span style={{ color: "#999", fontWeight: 400, fontSize: 12 }}>— tap to check that number</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {perms.map((p) => {
                const active = p === num;
                const fav = isFav(p);
                return (
                  <button key={p} onClick={() => go(p)}
                    style={{
                      minWidth: 64, padding: "6px 8px", borderRadius: 8, border: active ? "2px solid " + RED : "1px solid #ccc",
                      background: fav ? YELLOW : active ? "#ffe9e9" : "#fff", color: "#111", fontWeight: 700, cursor: "pointer", fontSize: 15, letterSpacing: 1,
                    }}>
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Filters */}
        {num ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Region</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {REGIONS.map((r) => (
                <button key={r} onClick={() => setRegion(r)} style={chip(region === r)}>{r === "M'sia" ? "M'sia" : r === "Sab, Sar" ? "Sab, Sar" : r}</button>
              ))}
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Prize</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PRIZES.map((p) => (
                <button key={p} onClick={() => setPrize(p)} style={chip(prize === p)}>{p === "All" ? "All" : p}</button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Result list */}
        {num ? (
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: 30, textAlign: "center", color: "#777" }}>Searching past results…</div>
            ) : err ? (
              <div style={{ padding: 30, textAlign: "center", color: "#cc0000" }}>{err}</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#777" }}>
                No past draw found for <b>{num}</b>.
                <div style={{ fontSize: 12, marginTop: 6, color: "#aaa" }}>Try another number, or check again after more draws.</div>
              </div>
            ) : (
              <div>
                <div style={{ padding: "10px 12px", borderBottom: "1px solid #eee", fontSize: 13, color: "#777" }}>
                  {filtered.length} result{filtered.length === 1 ? "" : "s"} {region !== "All" ? "· " + region : ""} {prize !== "All" ? "· " + prize : ""}
                </div>
                {filtered.map((m, i) => {
                  const fav = isFav(m.num);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: "1px solid #f0f0f0", background: fav ? YELLOW : "#fff" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid #e6e6e6", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#fff" }}>
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
          Numbers marked <span style={{ background: YELLOW, padding: "0 4px" }}>yellow</span> are your favourite numbers.
        </div>
      </div>
    </div>
  );
}

function chip(active: boolean): React.CSSProperties {
  return {
    padding: "5px 12px", borderRadius: 16, border: active ? "2px solid " + RED : "1px solid #ccc",
    background: active ? "#ffe9e9" : "#fff", color: active ? RED : "#333", fontWeight: active ? 700 : 500, cursor: "pointer", fontSize: 13,
  };
}


