"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CambodiaKhResults from "./CambodiaKhResults";
import { GAME_TABLES } from "./game-tables";

export type PastKind = "my" | "kh";

/** Which Cambodia column belongs to which game page. */
const KH_GAME: Record<string, "gd" | "nine" | "perdana" | "hari"> = {
  "grand-dragon": "gd",
  "nine-lotto": "nine",
  perdana: "perdana",
  "lucky-harihari": "hari",
};

/**
 * Past results are per game, never shared. Picking a date only switches the
 * area this filter sits in ("mkt-past-scope") to that date's cards, so swiping
 * to another game still shows that game's normal latest result.
 */
const SCOPE_CLASS = "mkt-past-scope";
const ON_CLASS = "mkt-past-on";

/** Dropdown stays light: the newest few are always ready, the rest on open. */
const QUICK_COUNT = 40;

function pretty(iso: string): string {
  const [y, m, d] = iso.split("-");
  const dt = new Date(iso + "T12:00:00");
  const wk = Number.isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US", { weekday: "short" });
  return d + "-" + m + "-" + y + (wk ? " (" + wk + ")" : "");
}

function monthLabel(iso: string): string {
  return iso.slice(0, 7);
}

export default function GamePastFilter({ slug, name, kind, dates, tables }: {
  slug: string;
  name: string;
  kind: PastKind;
  dates: string[];
  tables?: Record<string, string[]>;
}) {
  const wanted = GAME_TABLES[slug] || [];
  // The caller already hands us the exact dates this game has, so only the
  // Malaysia / Singapore list needs the per-game table check.
  const list = useMemo(() => {
    return dates
      .filter((d) => (kind === "kh" ? true : (!tables || !tables[d] || wanted.some((t) => (tables[d] || []).includes(t)))))
      .sort();
  }, [dates, kind, tables, wanted]);

  const [date, setDate] = useState("");
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [full, setFull] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Only this game's area switches: its latest cards hide while a date is shown.
  useEffect(() => {
    const scope = rootRef.current ? rootRef.current.closest("." + SCOPE_CLASS) : null;
    if (!scope) return;
    scope.classList.toggle(ON_CLASS, Boolean(date));
    return () => { scope.classList.remove(ON_CLASS); };
  }, [date]);

  useEffect(() => {
    if (!date) { setHtml(null); setErr(""); return; }
    if (kind === "kh") return; // Cambodia cards are rendered by the React component
    let alive = true;
    setLoading(true);
    setErr("");
    setHtml(null);
    fetch("/api/game-past?slug=" + encodeURIComponent(slug) + "&date=" + date, { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .then((j) => { if (alive) setHtml((j.html as string) || ""); })
      .catch(() => { if (alive) setErr("Could not load the past result. Please try again."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [date, kind, slug]);

  const latest = list.length ? list[list.length - 1] : "";
  const hasPast = list.length > 0;
  const openFull = () => setFull(true);

  // Newest first, grouped by month so a long history is easy to scan.
  const groups = useMemo(() => {
    const shown = full ? list : list.slice(-QUICK_COUNT);
    const out: { label: string; items: string[] }[] = [];
    for (let i = shown.length - 1; i >= 0; i--) {
      const d = shown[i];
      const label = monthLabel(d);
      if (!out.length || out[out.length - 1].label !== label) out.push({ label, items: [] });
      out[out.length - 1].items.push(d);
    }
    return out;
  }, [list, full]);

  return (
    <div ref={rootRef} style={{ margin: "8px 0 2px" }}>
      <div
        style={{
          border: "1px solid #e4e4e4", borderRadius: 10, background: "#fff",
          padding: "8px 10px", display: "flex", flexWrap: "wrap", gap: 8,
          alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <strong style={{ color: "#cc0000", fontSize: 14, whiteSpace: "nowrap" }}>
          {name} Past Result 过去开奖
        </strong>
        {hasPast ? (
          <>
            <select
              aria-label={"Past result date for " + name}
              value={date}
              onPointerDown={openFull}
              onTouchStart={openFull}
              onFocus={openFull}
              onChange={(e) => setDate(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ccc", minWidth: 220, fontWeight: 600, background: "#fff" }}
            >
              <option value="">Live results (latest) 最新开奖</option>
              {groups.flatMap((g) => g.items).map((d) => (
                <option key={d} value={d}>{pretty(d)}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setDate(latest)}
              style={{ padding: "6px 12px", borderRadius: 8, border: 0, background: "#cc0000", color: "#fff", fontWeight: 700, cursor: "pointer" }}
            >
              Latest 最新
            </button>
            <span style={{ fontSize: 12, color: "#888" }}>{list.length} 天 dates</span>
          </>
        ) : (
          <span style={{ color: "#777", fontSize: 13 }}>No past results yet.</span>
        )}
      </div>

      {date ? (
        <div className="text-center" style={{ margin: "6px 0 -2px", fontSize: 13, color: "#0a6b2d" }}>
          Showing past result for <strong>{pretty(date)}</strong>
          {" · "}
          <a href="#" onClick={(e) => { e.preventDefault(); setDate(""); }} style={{ color: "#cc0000", fontWeight: 700 }}>
            Back to latest 返回最新
          </a>
        </div>
      ) : null}

      {kind === "kh" ? (
        date ? <CambodiaKhResults date={date} only={KH_GAME[slug]} /> : null
      ) : (
        <>
          {loading ? <div className="alert alert-info mt-3 text-center">Loading past result…</div> : null}
          {err ? <div className="alert alert-warning mt-3 text-center">{err}</div> : null}
          {!loading && html !== null ? (
            html.trim() === ""
              ? <div className="alert alert-warning mt-3 text-center">No result for this date.</div>
              : <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : null}
        </>
      )}
    </div>
  );
}
