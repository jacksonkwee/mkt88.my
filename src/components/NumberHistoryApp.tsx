"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CaretDown, CaretUp, Check, Star } from "@phosphor-icons/react";
import { FAV_EVENT, YELLOW, loadFavs, toggleFav, type Fav } from "../lib/favourites";

const RED = "#cc0000";
const YELLOW_SOFT = "#fff3d0";

type ApiMatch = { date: string; game: string; logo: string; region: string; prize: string; num: string };
type ApiResp = { nums: string[]; matches: ApiMatch[]; total: number; dbFrom?: string; dbTo?: string; perNum?: Record<string, number>; logos?: Record<string, string> };

/*
 * The answer carries one copy of each game logo in `logos`, and each row
 * carries a short key. Repeating the ~90 character path on every row made a
 * permutation search over half a megabyte for no reason.
 */
const logoSrc = (data: ApiResp | null, key: string): string =>
  (data && data.logos ? (data.logos[key] || "") : key);
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
  const router = useRouter();
  const initial = (params.get("num") || "").replace(/\D/g, "").slice(0, 4);

  const [input, setInput] = useState(isNum(initial) ? initial : "");
  const [selected, setSelected] = useState<string[]>(isNum(initial) ? [initial] : []);
  const [mode, setMode] = useState<"single" | "pau" | "reverse" | "custom">("single");
  const [regions, setRegions] = useState<string[]>([]);
  const [prizes, setPrizes] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [showCompanies, setShowCompanies] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
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

  /*
   * Region and Prize start with EVERYTHING on - an empty list means "no filter".
   * So a chip click has to switch from "all" to "all except this one" rather
   * than adding it, which would have narrowed the results to just that one.
   */
  const TOGGLE_ALL = (arr: string[], set: (v: string[]) => void, v: string, universe: string[]) => {
    const current = arr.length ? arr : universe;
    const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
    set(next.length === universe.length ? [] : next);
  };
  const isOnAll = (arr: string[], v: string) => arr.length === 0 || arr.includes(v);

  const isFav = (n: string) => favs.some((f) => f.num === n);
  const onToggleFav = (n: string) => { toggleFav(n); setFavs(loadFavs()); };

  const daboThumb = dabo ? (daboBad ? "/api/dabogong/img?u=" + encodeURIComponent(dabo.image) : dabo.image) : "";

  return (
    <div style={{ minHeight: "100vh", background: "#f4f4f4", fontFamily: "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif", paddingBottom: 70 }}>
      <div className="mkt-app-topbar" style={{ position: "sticky", top: 0, zIndex: 50, background: RED, color: "#fff", display: "flex", alignItems: "center", gap: 6, padding: "10px 8px", boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}>
        <button onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          style={{ background: "transparent", border: 0, color: "#fff", fontSize: 24, lineHeight: 1, cursor: "pointer", padding: "2px 8px" }} aria-label="Back"><ArrowLeft size={24} weight="bold" /></button>
        <div style={{ flex: 1, textAlign: "center", fontWeight: 800, fontSize: 18, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          Number History 开彩记录
        </div>
        <Link href="/" onClick={() => window.dispatchEvent(new Event("mkt-home"))} style={{ color: "#fff", fontSize: 13, textDecoration: "none", padding: "6px 8px" }}>Home</Link>
      </div>

      {/* Brand logo at the top of the page. */}
      <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 2px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/sites/live4dresult-net-0600c55d/root-8a5edab2/logo-mkt88.svg?v=3" alt="MKT 發發" style={{ height: 44, width: "auto", maxWidth: "70%", display: "block" }} />
      </div>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: 12 }}>
        {/* Search + 大伯公 */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Search a 4D number</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={input}
              onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="e.g. 1782"
              inputMode="numeric"
              style={{ flex: 1, minWidth: 0, padding: "10px 12px", border: "1px solid #ccc", borderRadius: 12, fontSize: 18, letterSpacing: 6, textAlign: "center", fontWeight: 800 }} />
            <button onClick={search} style={{ background: RED, color: "#fff", border: 0, borderRadius: 12, padding: "0 18px", fontSize: 15, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>Search</button>
          </div>

          {/* 大伯公 meaning (small) */}
          {dabo && primary ? (
            <Link href={"/dabogong?num=" + primary}
              style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, padding: 8, borderRadius: 12, background: YELLOW_SOFT, textDecoration: "none", color: "#111" }}>
              <img src={daboThumb} alt={dabo.keyword || primary} referrerPolicy="no-referrer" onError={() => setDaboBad(true)}
                style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 12, background: "#fff", border: "1px solid #eee" }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#8a6d00", fontWeight: 700 }}>大伯公 {dabo.kind}</div>
                <div style={{ fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {dabo.keyword || primary}{dabo.meaning ? <span style={{ fontWeight: 500, color: "#555" }}> · {dabo.meaning}</span> : null}
                </div>
              </div>
              <div style={{ marginLeft: "auto", fontSize: 11, color: "#8a6d00" }}>查看 ›</div>
            </Link>
          ) : null}

          {primary ? (
            <>
              {/* One line: the three checks share the width instead of wrapping. */}
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "nowrap" }}>
                <button onClick={() => setSelected([primary])} style={modeBtn(mode === "single")}>Single 单一</button>
                <button onClick={() => setSelected(perms)} style={modeBtn(mode === "pau")}>Pau 包 (all {perms.length})</button>
                <button onClick={() => setSelected(reverseSet)} style={modeBtn(mode === "reverse")}>Reverse 来回</button>
              </div>
            </>
          ) : null}

          {data ? (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button onClick={() => onToggleFav(primary || data.nums[0])}
                  style={{ border: "1px solid " + RED, borderRadius: 12, padding: "6px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", background: isFav(primary || data.nums[0]) ? YELLOW : "#fff", color: isFav(primary || data.nums[0]) ? "#111" : RED }}>
                  {isFav(primary || data.nums[0]) ? <><Star size={13} weight="fill" style={{ verticalAlign: "-2px", marginRight: 4 }} />Favourite</> : <><Star size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />Add favourite</>}
                </button>
                <Link href={"/favourites?num=" + (primary || data.nums[0])}
                  style={{ border: "1px solid #ddd", borderRadius: 12, padding: "6px 10px", fontSize: 13, fontWeight: 700, color: "#333", textDecoration: "none", background: "#fff", flexShrink: 0, whiteSpace: "nowrap" }}>
                  <Star size={13} weight="fill" style={{ verticalAlign: "-2px", marginRight: 4 }} />Pau / Notify
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        {/* Filters */}
        {data ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", marginBottom: 12 }}>
            {/*
             * One bar for Region and Prize. Everything is included until you
             * change something, so the chip rows stay tucked away instead of
             * pushing the results off the screen.
             */}
            {/* One row for all three filters. */}
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setShowFilters((v) => !v)} style={tabBtn(showFilters)}>
                Region 地区{regions.length ? " *" : ""}
              </button>
              <button onClick={() => setShowFilters((v) => !v)} style={tabBtn(showFilters)}>
                Prize 奖项{prizes.length ? " *" : ""}
              </button>
              <button onClick={() => setShowCompanies((v) => !v)} style={tabBtn(showCompanies)}>
                公司 Company{companies.length ? " *" : ""}
              </button>
            </div>
            {showFilters ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Region 地区</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  <button onClick={() => setRegions([])} style={chip(regions.length === 0)}>All 全部</button>
                  {REGIONS.map((r) => (
                    <button key={r} onClick={() => TOGGLE_ALL(regions, setRegions, r, REGIONS)} style={chip(isOnAll(regions, r))}>{r}</button>
                  ))}
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Prize 奖项</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  <button onClick={() => setPrizes([])} style={chip(prizes.length === 0)}>All 全部</button>
                  {PRIZES.map((p) => (
                    <button key={p} onClick={() => TOGGLE_ALL(prizes, setPrizes, p, PRIZES)} style={chip(isOnAll(prizes, p))}>{p}</button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* The Company chips open under the Company tab above. */}
            {showCompanies ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <button onClick={() => setCompanies([])} style={chip(companies.length === 0)}>All 全部</button>
                  {COMPANIES.filter((c) => companyCounts.has(c.key)).map((c) => {
                    const on = companies.includes(c.key);
                    return (
                      <button key={c.key} onClick={() => toggleIn(companies, setCompanies, c.key)} style={chip(on)}>
                        {on ? <Check size={13} weight="bold" style={{ verticalAlign: "-2px", marginRight: 3 }} /> : null}{c.label} <span style={{ color: "#999" }}>{companyCounts.get(c.key)}</span>
                      </button>
                    );
                  })}
                  {companyCounts.has("other") ? (
                    <button onClick={() => toggleIn(companies, setCompanies, "other")} style={chip(companies.includes("other"))}>
                      {companies.includes("other") ? <Check size={13} weight="bold" style={{ verticalAlign: "-2px", marginRight: 3 }} /> : null}其他 Other <span style={{ color: "#999" }}>{companyCounts.get("other")}</span>
                    </button>
                  ) : null}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: "#999" }}>
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
                <div style={{ fontSize: 13, marginTop: 6, color: "#aaa" }}>Try another number or clear the filters.</div>
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
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 10px", borderBottom: "1px solid #f0f0f0", background: fav ? YELLOW : "#fff", whiteSpace: "nowrap" }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, border: "1px solid #e6e6e6", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#fff", flexShrink: 0 }}>
                        {logoSrc(data, m.logo) ? <img src={logoSrc(data, m.logo)} alt="" style={{ maxWidth: 22, maxHeight: 22 }} /> : <span style={{ fontSize: 10, color: "#999" }}>4D</span>}
                      </div>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", fontWeight: 700, fontSize: 14 }}>{m.game}</span>
                      <span style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>{shortDate(m.date)}</span>
                      <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: 1, flexShrink: 0 }}>{m.num}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: PRIZE_COLORS[m.prize] || "#777", borderRadius: 10, padding: "2px 6px", flexShrink: 0 }}>{shortPrize(m.prize)}</span>
                      <button onClick={() => onToggleFav(m.num)} title="Favourite"
                        style={{ background: "transparent", border: 0, cursor: "pointer", padding: 2, color: fav ? "#e6a700" : "#bbb", flexShrink: 0, lineHeight: 0 }}>
                        {fav ? <Star size={16} weight="fill" /> : <Star size={16} />}
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
            Records: Magnum 4D from 25/08/1985 · Da Ma Cai 1+3D and Sports Toto 4D from 1992 · Sandakan from 1995 · Cash Sweep from 1996 · Sabah 88 from 2001 · Singapore 4D from 2007 · Perdana and Lucky HariHari from 2021 · Grand Dragon from 2022 · Nine Lotto from 2023.
          </div>
        </div>
      </div>
    </div>
  );
}

function modeBtn(active: boolean): React.CSSProperties {
  return {
    flex: 1, minWidth: 0, textAlign: "center", whiteSpace: "nowrap",
    padding: "6px 6px", borderRadius: 12, fontSize: 12.5, fontWeight: active ? 700 : 500, cursor: "pointer",
    border: active ? "2px solid " + RED : "1px solid #ccc", background: active ? "#ffe9e9" : "#fff", color: active ? RED : "#333",
  };
}
/** Region / Prize / Company tabs - all three sit on one row. */
function tabBtn(active: boolean): React.CSSProperties {
  return {
    flex: 1, minWidth: 0, textAlign: "center", whiteSpace: "nowrap",
    padding: "6px 4px", borderRadius: 12, fontSize: 12.5, cursor: "pointer",
    border: active ? "2px solid " + RED : "1px solid #ccc",
    background: active ? RED : "#fff", color: active ? "#fff" : "#333", fontWeight: 700,
  };
}
function chip(active: boolean): React.CSSProperties {
  return {
    padding: "5px 12px", borderRadius: 12, fontSize: 13, cursor: "pointer",
    border: active ? "2px solid " + RED : "1px solid #ccc",
    background: active ? "#ffe9e9" : "#fff", color: active ? RED : "#333", fontWeight: active ? 700 : 500,
  };
}

/*
 * Result rows are one line each (logo · game · date · number · prize), so the
 * date and the prize name are shortened: "23-08-2025 (Sat)" -> "23/08/25" and
 * "Consolation" -> "Con". Without this the row wraps and stops being one line.
 */
function shortDate(d: string): string {
  const m = /(\d{2})[-/](\d{2})[-/](\d{4})/.exec(d || "");
  return m ? `${m[1]}/${m[2]}/${m[3].slice(2)}` : (d || "");
}
function shortPrize(p: string): string {
  const s = p || "";
  if (/^consol/i.test(s)) return "Con";
  if (/^spec/i.test(s)) return "Spe";
  if (/^1st/i.test(s)) return "1st";
  if (/^2nd/i.test(s)) return "2nd";
  if (/^3rd/i.test(s)) return "3rd";
  return s.slice(0, 3);
}
