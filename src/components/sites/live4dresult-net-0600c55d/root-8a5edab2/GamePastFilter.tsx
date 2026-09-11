"use client";

import { useEffect, useState } from "react";
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
 * While any filter has a date picked, the page hides the live/today cards so
 * only the chosen past draw is on screen. A shared counter keeps it correct
 * when several filters are on the page at once (the phone swipe slides).
 */
const PAST_MODE_CLASS = "mkt-past-mode";
let activeFilters = 0;
function setPastMode(on: boolean) {
  activeFilters = Math.max(0, activeFilters + (on ? 1 : -1));
  if (typeof document !== "undefined") {
    document.body.classList.toggle(PAST_MODE_CLASS, activeFilters > 0);
  }
}

function pretty(iso: string): string {
  const [y, m, d] = iso.split("-");
  const dt = new Date(iso + "T12:00:00");
  const wk = Number.isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US", { weekday: "short" });
  return d + "-" + m + "-" + y + (wk ? " (" + wk + ")" : "");
}

/**
 * Past-result date filter shown under a game's title. Picking a date replaces
 * the live results with that game's cards for the chosen date.
 */
export default function GamePastFilter({ slug, name, kind, dates, tables }: {
  slug: string;
  name: string;
  kind: PastKind;
  dates: string[];
  tables?: Record<string, string[]>;
}) {
  const wanted = GAME_TABLES[slug] || [];
  const list = dates
    .filter((d) => !tables || !tables[d] || wanted.some((t) => (tables[d] || []).includes(t)))
    .sort();
  const [date, setDate] = useState("");
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Past mode: hide the live cards while a date is picked, restore on clear.
  useEffect(() => {
    if (!date) return;
    setPastMode(true);
    return () => setPastMode(false);
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

  return (
    <div style={{ margin: "8px 0 2px" }}>
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
              onChange={(e) => setDate(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ccc", minWidth: 210, fontWeight: 600, background: "#fff" }}
            >
              <option value="">Live results (latest) 最新开奖</option>
              {list.slice().reverse().map((d) => (
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
