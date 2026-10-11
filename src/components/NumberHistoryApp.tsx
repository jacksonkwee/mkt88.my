"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CaretDown, CaretUp, Check, Star } from "@phosphor-icons/react";
import { FAV_EVENT, YELLOW, loadFavs, toggleFav, type Fav } from "../lib/favourites";
import { useLang, tr, type Lang } from "../lib/i18n";
import { toSimplified } from "../lib/zh-simplified";
import AppTopBar from "./AppTopBar";

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
/** The filter values above are the API's own keys; these are their labels. */
const REGION_KEY: Record<string, string> = { "M'sia": "nhR1", "Sab, Sar": "nhR2", Spore: "nhR3", Others: "nhR4" };
const PRIZE_KEY: Record<string, string> = { "1st": "nhP1", "2nd": "nhP2", "3rd": "nhP3", Special: "nhPS", Consolation: "nhPC" };
const PRIZE_SHORT_KEY: Record<string, string> = { "1st": "nhP1short", "2nd": "nhP2short", "3rd": "nhP3short", Special: "nhPSshort", Consolation: "nhPCshort" };
const MAX_ROWS = 400;

/** The 11 game companies used by the app, plus a catch-all bucket. */
const COMPANIES: { key: string; label: string; re: RegExp }[] = [
  { key: "magnum", label: "Magnum 万能", re: /magnum 4d/i },
  { key: "damacai", label: "Da Ma Cai 大马彩", re: /da ma cai/i },
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
  const [lang] = useLang();
  const initial = (params.get("num") || "").replace(/\D/g, "").slice(0, 4);

  /**
   * A different example number every time the screen opens, so the hint never
   * looks like a fixed number. The first render keeps a fixed value so the
   * server and the browser agree on the markup; the random one arrives a moment
   * later.
   */
  const [example, setExample] = useState("1236");
  useEffect(() => {
    setExample(String(Math.floor(Math.random() * 10000)).padStart(4, "0"));
  }, []);

  /** The 大伯公 API returns the chart kind in Chinese; show it in the reader's language. */
  const kindLabel = (k: string) =>
    k === "万字图" ? tr("dbgKind10k", lang) : k === "大伯公千字图" ? tr("dbgKind1k", lang) : k;

  const [input, setInput] = useState(isNum(initial) ? initial : "");
  const [selected, setSelected] = useState<string[]>(isNum(initial) ? [initial] : []);
  const [mode, setMode] = useState<"single" | "pau" | "reverse" | "custom">("single");
  const [regions, setRegions] = useState<string[]>([]);
  const [prizes, setPrizes] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [showCompanies, setShowCompanies] = useState(false);
  /* Each tab opens ONLY its own chips - Region no longer drags Prize in too. */
  const [showRegion, setShowRegion] = useState(false);
  const [showPrize, setShowPrize] = useState(false);
  const [data, setData] = useState<ApiResp | null>(null);
  const [dabo, setDabo] = useState<Dabo | null>(null);
  const [daboBad, setDaboBad] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errKey, setErrKey] = useState("");
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
    setErrKey("");
    fetch("/api/number-history?nums=" + list.join(","), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!mounted.current || id !== reqId.current) return;
        setData(j);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted.current || id !== reqId.current) return;
        setErrKey("nhLoadFail");
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

  /*
   * A chip adds to the selection; tapping it again removes it.
   *
   * An empty list means "no filter", so every chip in a group reads as on while
   * everything is included. Because adding to an empty list is the same as
   * picking that one value, the first tap narrows the group to just the value
   * tapped. After that the taps accumulate: Malaysia then Sabah shows both,
   * then tapping Malaysia again leaves Sabah on. The All chip clears the group
   * back to everything.
   */
  const toggleChip = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const isOnAll = (arr: string[], v: string) => arr.length === 0 || arr.includes(v);

  const isFav = (n: string) => favs.some((f) => f.num === n);

  const daboThumb = dabo ? (daboBad ? "/api/dabogong/img?u=" + encodeURIComponent(dabo.image) : dabo.image) : "";

  return (
    <div style={{ minHeight: "100vh", background: "#f4f4f4", fontFamily: "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif", paddingBottom: 70 }}>
      <AppTopBar titleKey="history" />
      <div style={{ maxWidth: 560, margin: "0 auto", padding: 12 }}>
        {/* Search + 大伯公 */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{tr("nhSearchTitle", lang)}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={input}
              onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder={tr("nhPlaceholderPrefix", lang) + " " + example}
              inputMode="numeric"
              style={{ flex: 1, minWidth: 0, padding: "10px 12px", border: "1px solid #ccc", borderRadius: 12, fontSize: 18, letterSpacing: 6, textAlign: "center", fontWeight: 800 }} />
            <button onClick={search} style={{ background: RED, color: "#fff", border: 0, borderRadius: 12, padding: "0 18px", fontSize: 15, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>{tr("nhSearchBtn", lang)}</button>
          </div>

          {/* 大伯公 meaning (small) */}
          {dabo && primary ? (
            <Link href={"/dabogong?num=" + primary}
              style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, padding: 8, borderRadius: 12, background: YELLOW_SOFT, textDecoration: "none", color: "#111" }}>
              <img src={daboThumb} alt={dabo.keyword || primary} referrerPolicy="no-referrer" onError={() => setDaboBad(true)}
                style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 12, background: "#fff", border: "1px solid #eee" }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#8a6d00", fontWeight: 700 }}>{tr("dabogong", lang)} {kindLabel(dabo.kind)}</div>
                <div style={{ fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {dabo.keyword || primary}{dabo.meaning ? <span style={{ fontWeight: 500, color: "#555" }}> · {dabo.meaning}</span> : null}
                </div>
              </div>
              <div style={{ marginLeft: "auto", fontSize: 11, color: "#8a6d00" }}>{tr("nhView", lang)}</div>
            </Link>
          ) : null}

          {primary ? (
            <>
              {/* One line: the three checks share the width instead of wrapping. */}
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "nowrap" }}>
                <button onClick={() => setSelected([primary])} style={modeBtn(mode === "single")}>{tr("nhSingle", lang)}</button>
                <button onClick={() => setSelected(perms)} style={modeBtn(mode === "pau")}>{tr("nhPau", lang)} ({tr("nhAll", lang)} {perms.length})</button>
                <button onClick={() => setSelected(reverseSet)} style={modeBtn(mode === "reverse")}>{tr("nhReverse", lang)}</button>
              </div>
            </>
          ) : null}

        </div>

        {/* Filters */}
        {data ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", marginBottom: 12 }}>
            {/*
             * One bar for Region, Prize and Company. Everything is included
             * until you tap a chip, and further taps add to the group, so
             * Malaysia plus Sabah can both be on at once. The chip rows stay
             * tucked away until their tab is opened, so they never push the
             * results off the screen.
             */}
            {/* One row for all three filters. */}
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setShowRegion((v) => !v)} style={tabBtn(showRegion)}>
                {tr("nhRegion", lang)}{regions.length ? " *" : ""}
              </button>
              <button onClick={() => setShowPrize((v) => !v)} style={tabBtn(showPrize)}>
                {tr("nhPrize", lang)}{prizes.length ? " *" : ""}
              </button>
              <button onClick={() => setShowCompanies((v) => !v)} style={tabBtn(showCompanies)}>
                {tr("nhCompany", lang)}{companies.length ? " *" : ""}
              </button>
            </div>
            {showRegion ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                <button onClick={() => setRegions([])} style={chip(regions.length === 0)}>{tr("nhAll", lang)}</button>
                {REGIONS.map((r) => (
                  <button key={r} onClick={() => toggleChip(regions, setRegions, r)} style={chip(isOnAll(regions, r))}>{tr(REGION_KEY[r] || "", lang)}</button>
                ))}
              </div>
            ) : null}
            {showPrize ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                <button onClick={() => setPrizes([])} style={chip(prizes.length === 0)}>{tr("nhAll", lang)}</button>
                {PRIZES.map((p) => (
                  <button key={p} onClick={() => toggleChip(prizes, setPrizes, p)} style={chip(isOnAll(prizes, p))}>{tr(PRIZE_KEY[p] || "", lang)}</button>
                ))}
              </div>
            ) : null}

            {/* The Company chips open under the Company tab above. */}
            {showCompanies ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <button onClick={() => setCompanies([])} style={chip(companies.length === 0)}>{tr("nhAll", lang)}</button>
                  {COMPANIES.filter((c) => companyCounts.has(c.key)).map((c) => {
                    const on = companies.includes(c.key);
                    return (
                      <button key={c.key} onClick={() => toggleChip(companies, setCompanies, c.key)} style={chip(on)}>
                        {on ? <Check size={13} weight="bold" style={{ verticalAlign: "-2px", marginRight: 3 }} /> : null}{c.label} <span style={{ color: "#999" }}>{companyCounts.get(c.key)}</span>
                      </button>
                    );
                  })}
                  {companyCounts.has("other") ? (
                    <button onClick={() => toggleChip(companies, setCompanies, "other")} style={chip(companies.includes("other"))}>
                      {companies.includes("other") ? <Check size={13} weight="bold" style={{ verticalAlign: "-2px", marginRight: 3 }} /> : null}{tr("nhOther", lang)} <span style={{ color: "#999" }}>{companyCounts.get("other")}</span>
                    </button>
                  ) : null}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: "#999" }}>
                  {tr("nhCompanyHelp", lang)}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Results */}
        {selected.length ? (
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: 30, textAlign: "center", color: "#777" }}>{tr("nhSearching", lang)}</div>
            ) : errKey ? (
              <div style={{ padding: 30, textAlign: "center", color: RED }}>{tr(errKey, lang)}</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#777" }}>
                {tr("nhNoDraw", lang)}
                <div style={{ fontSize: 13, marginTop: 6, color: "#aaa" }}>{tr("nhNoDrawHint", lang)}</div>
              </div>
            ) : (
              <div>
                {/* Count on the left, Favourite on the same line on the right. */}
                <div style={{ padding: "8px 10px", borderBottom: "1px solid #eee", fontSize: 13, color: "#777", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {tr("nhShowing", lang)} {Math.min(filtered.length, MAX_ROWS)} {tr("nhOf", lang)} {filtered.length} {filtered.length === 1 ? tr("nhResultOne", lang) : tr("nhResultMany", lang)}
                    {regions.length ? " · " + regions.map((r) => tr(REGION_KEY[r] || "", lang)).join(" + ") : ""}
                    {prizes.length ? " · " + prizes.map((p) => tr(PRIZE_KEY[p] || "", lang)).join(" + ") : ""}
                    {companies.length ? " · " + companies.length + " " + tr("nhCompanies", lang) : ""}
                  </span>
                  {data ? (
                    <Link href={"/favourites?num=" + (primary || data.nums[0])}
                      style={{ border: "1px solid " + RED, borderRadius: 12, padding: "4px 9px", fontSize: 12.5, fontWeight: 700, color: RED, textDecoration: "none", background: "#fff", flexShrink: 0, whiteSpace: "nowrap" }}>
                      <Star size={12} weight="fill" style={{ verticalAlign: "-2px", marginRight: 3 }} />{tr("nhFav", lang)}
                    </Link>
                  ) : null}
                </div>
                {filtered.slice(0, MAX_ROWS).map((m, i) => {
                  const fav = isFav(m.num);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 10px", borderBottom: "1px solid #f0f0f0", background: fav ? YELLOW : "#fff", whiteSpace: "nowrap" }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, border: "1px solid #e6e6e6", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#fff", flexShrink: 0 }}>
                        {logoSrc(data, m.logo) ? <img src={logoSrc(data, m.logo)} alt="" style={{ maxWidth: 22, maxHeight: 22 }} /> : <span style={{ fontSize: 10, color: "#999" }}>4D</span>}
                      </div>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", fontWeight: 700, fontSize: 14 }}>{toSimplified(m.game)}</span>
                      <span style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>{shortDate(m.date)}</span>
                      <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: 1, flexShrink: 0 }}>{m.num}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: PRIZE_COLORS[m.prize] || "#777", borderRadius: 10, padding: "2px 6px", flexShrink: 0 }}>{prizeShort(m.prize, lang)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, padding: 30, textAlign: "center", color: "#888", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
            {tr("nhEmpty", lang)}
          </div>
        )}

        <div style={{ textAlign: "center", color: "#aaa", fontSize: 11, marginTop: 16 }}>
          {tr("nhNotePerm", lang)}
          <div style={{ marginTop: 4 }}>
            {tr("nhNoteRecords", lang)}
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
/** The prize badge is one small pill, so each language gets its own short name. */
function prizeShort(p: string, lang: Lang): string {
  const key = PRIZE_SHORT_KEY[p];
  return key ? tr(key, lang) : (p || "").slice(0, 3);
}
