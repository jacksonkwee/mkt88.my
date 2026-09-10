"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FAV_EVENT, YELLOW, loadFavs, toggleFav, type Fav } from "../lib/favourites";

const RED = "#cc0000";
const YELLOW_SOFT = "#fff3d0";

type ApiMatch = { date: string; game: string; logo: string; region: string; prize: string; num: string };
type ApiResp = { nums: string[]; matches: ApiMatch[]; total: number; dbFrom?: string; dbTo?: string; perNum?: Record<string, number> };
type Dabo = { num: string; kind: string; keyword: string; meaning: string; image: string; found: boolean };

const REGIONS = ["M'sia", "Sab, Sar", "Spore", "Others"];
const PRIZES = ["1st", "2nd", "3rd", "Special", "Consolation"];
const PRIZE_COLORS: Record<string, string> = {
  "1st": "#d40000", "2nd": "#0066cc", "3rd": "#008a3e", Special: "#8a4a00", Consolation: "#555",
};
const MAX_ROWS = 400;

/** The 11 game companies used by the app, plus a catch-all bucket. */
const COMPANIES: { key: string; label: string; re: RegExp }[] = [
  { key: "magnum", label: "Magnum 萬能", re: /magnum 4d/i },
  { key: "damacai", label: "Da Ma Cai 大馬彩", re: /da ma cai/i },
  { key: "toto", label: "Sports Toto 多多", re: /sportstoto|sports ?toto/i },
  { key: "sg", label: "Singapore 4D 新加坡", re: /singapore/i },
  { key: "gd", label: "Grand Dragon 豪龙", re: /grand dragon/i },
  { key: "nine", label: "Nine Lotto", re: /nine lotto/i },
  { key: "sabah88", label: "Sabah 88 沙巴88", re: /sabah/i },
  { key: "sandakan", label: "Sandakan 山打根", re: /sandakan/i },
  { key: "cashsweep", label: "Cash Sweep 沙捞越", re: /cash\s*sweep/i },
  { key: "perdana", label: "Perdana 4D", re: /perdana/i },
  { key: "harihari", label: "Lucky HariHari 天天好运", re: /hari\s*hari/i },
];
const companyOf = (game: string) => (COMPANIES.find((c) => c.re.test(game)) || { key: "other" }).key;

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
  const [companies, setCompanies] = useState<string[]>([]);
  const [showCompanies, setShowCompanies] = useState(false);
  const [data, setData] = useState<ApiResp | null>(null);
  const [dabo, setDabo] = useState<Dabo | null>(null);
  const [daboBad, setDaboBad] = useState(false);
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

  // 大伯公 meaning for the number in the search bar.
  useEffect(() => {
    if (!primary) { setDabo(null); return; }
    let alive = true;
    setDaboBad(false);
    fetch("/api/dabogong?num=" + primary, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j && !j.error) setDabo(j); })
      .catch(() => { if (alive) setDabo(null); });
    return () => { alive = false; };
  }, [primary]);

  useEffect(() => {
    if (!primary) return;
    const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
    if (same(selected, [primary])) setMode("single");
    else if (same(selected, perms)) setMode("pau");
    else if (same(selected, reverseSet)) setMode("reverse");
    else setMode("custom");
  }, [selected, primary, perms, reverseSet]);

  const pick = (n: string) => { setSelected([n]); setInput(n); };
  const search = () => { if (isNum(input)) { setSelected([input]); fetchFor([input]); } };

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.matches;
    if (regions.length) list = list.filter((m) => regions.includes(m.region));
    if (prizes.length) list = list.filter((m) => prizes.includes(m.prize));
    if (companies.length) list = list.filter((m) => companies.includes(companyOf(m.game)));
    return list;
  }, [data, regions, prizes, companies]);

  /** Companies that actually appear in this search, with result counts. */
  const companyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (data) for (const m of data.matches) {
      const k = companyOf(m.game);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return counts;
  }, [data]);

  const toggleIn = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const isFav = (n: string) => favs.some((f) => f.num === n);
  const onToggleFav = (n: string) => { toggleFav(n); setFavs(loadFavs()); };

  const daboThumb = dabo ? (daboBad ? "/api/dabogong/img?u=" + encodeURIComponent(dabo.image) : dabo.image) : "";

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
        {/* Search + 大伯公 */}
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

          {/* 大伯公 meaning (small) */}
          {dabo && primary ? (
            <a href={"/dabogong?num=" + primary}
              style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, padding: 8, borderRadius: 10, background: YELLOW_SOFT, textDecoration: "none", color: "#111" }}>
              <img src={daboThumb} alt={dabo.keyword || primary} referrerPolicy="no-referrer" onError={() => setDaboBad(true)}
                style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 8, background: "#fff", border: "1px solid #eee" }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#8a6d00", fontWeight: 700 }}>大伯公 {dabo.kind}</div>
                <div style={{ fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {dabo.keyword || primary}{dabo.meaning ? <span style={{ fontWeight: 500, color: "#555" }}> · {dabo.meaning}</span> : null}
                </div>
              </div>
              <div style={{ marginLeft: "auto", fontSize: 11, color: "#8a6d00" }}>查看 ›</div>
            </a>
          ) : null}

          {primary ? (
            <>
              <div style={{ marginTop: 10, fontWeight: 700, fontSize: 13.5 }}>What to check 查询方式</div>
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <button onClick={() => setSelected([primary])} style={modeBtn(mode === "single")}>Single 单一 {primary}</button>
                <button onClick={() => setSelected(perms)} style={modeBtn(mode === "pau")}>Pau 包 (all {perms.length})</button>
                <button onClick={() => setSelected(reverseSet)} style={modeBtn(mode === "reverse")}>Reverse 来回 {reverseSet.join(" / ")}</button>
              </div>
              <div style={{ marginTop: 10, fontSize: 12.5, color: "#555" }}>
                Checking <b>{selected.length}</b> number{selected.length === 1 ? "" : "s"}:{" "}
                <span style={{ color: "#111", fontWeight: 600 }}>
                  {selected.slice(0, 16).join(", ")}{selected.length > 16 ? ` +${selected.length - 16} more` : ""}
                </span>
              </div>
            </>
          ) : null}

          {data ? (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, color: "#555" }}>
                {data.total} result{data.total === 1 ? "" : "s"} from {data.nums.length} number{data.nums.length === 1 ? "" : "s"}
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

        {/* Filters */}
        {data ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Region 地区 {regions.length ? <span style={{ color: RED }}>({regions.length})</span> : null}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              <button onClick={() => setRegions([])} style={chip(regions.length === 0)}>All 全部</button>
              {REGIONS.map((r) => (
                <button key={r} onClick={() => toggleIn(regions, setRegions, r)} style={chip(regions.includes(r))}>{r}</button>
              ))}
            </div>

            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Prize 奖项 {prizes.length ? <span style={{ color: RED }}>({prizes.length})</span> : null}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              <button onClick={() => setPrizes([])} style={chip(prizes.length === 0)}>All 全部</button>
              {PRIZES.map((p) => (
                <button key={p} onClick={() => toggleIn(prizes, setPrizes, p)} style={chip(prizes.includes(p))}>{p}</button>
              ))}
            </div>

            {/* Company filter (optional) */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                公司 Company {companies.length ? <span style={{ color: RED }}>({companies.length})</span> : <span style={{ color: "#999", fontWeight: 400, fontSize: 12 }}> all {companyCounts.size}</span>}
              </div>
              <button onClick={() => setShowCompanies((v) => !v)}
                style={{ border: "1px solid " + RED, background: showCompanies ? RED : "#fff", color: showCompanies ? "#fff" : RED, borderRadius: 8, padding: "5px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                {showCompanies ? "收起 Filter ▲" : "筛选 Filter ▼"}
              </button>
            </div>
            {showCompanies ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <button onClick={() => setCompanies([])} style={chip(companies.length === 0)}>All 全部</button>
                  {COMPANIES.filter((c) => companyCounts.has(c.key)).map((c) => {
                    const on = companies.includes(c.key);
                    return (
                      <button key={c.key} onClick={() => toggleIn(companies, setCompanies, c.key)} style={chip(on)}>
                        {on ? "✓ " : ""}{c.label} <span style={{ color: "#999" }}>{companyCounts.get(c.key)}</span>
                      </button>
                    );
                  })}
                  {companyCounts.has("other") ? (
                    <button onClick={() => toggleIn(companies, setCompanies, "other")} style={chip(companies.includes("other"))}>
                      {companies.includes("other") ? "✓ " : ""}其他 Other <span style={{ color: "#999" }}>{companyCounts.get("other")}</span>
                    </button>
                  ) : null}
                </div>
                <div style={{ marginTop: 6, fontSize: 11.5, color: "#999" }}>
                  Tick the companies you want to see, untick to hide. Nothing ticked = show all.
                </div>
              </div>
            ) : null}
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
                No past draw found for the selected filters.
                <div style={{ fontSize: 12, marginTop: 6, color: "#aaa" }}>Try another number or clear the filters.</div>
              </div>
            ) : (
              <div>
                <div style={{ padding: "10px 12px", borderBottom: "1px solid #eee", fontSize: 13, color: "#777" }}>
                  Showing {Math.min(filtered.length, MAX_ROWS)} of {filtered.length} result{filtered.length === 1 ? "" : "s"}
                  {regions.length ? " · " + regions.join(" + ") : ""}
                  {prizes.length ? " · " + prizes.join(" + ") : ""}
                  {companies.length ? " · " + companies.length + " company(s)" : ""}
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
          <div style={{ marginTop: 4 }}>
            Records: Magnum 4D from 25/08/1985 · Sports Toto 4D from 1992 · other games from 2022.
          </div>
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
