"use client";

import { useEffect, useRef, useState } from "react";
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

function pretty(iso: string): string {
  const [y, m, d] = iso.split("-");
  const dt = new Date(iso + "T12:00:00");
  const wk = Number.isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US", { weekday: "short" });
  return d + "-" + m + "-" + y + (wk ? " (" + wk + ")" : "");
}

/**
 * Past-result date filter shown under a game's title. Picking a date renders
 * that game's card(s) for the date - and nothing else.
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
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!date) { setHtml(null); return; }
    if (kind === "kh") return; // Cambodia cards are rendered by the React component
    let alive = true;
    setLoading(true);
    setErr("");
    setHtml(null);
    fetch("/api/game-past?slug=" + encodeURIComponent(slug) + "&date=" + date, { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .then((j) => { if (alive) setHtml((j.html as string) || ""); })
      .catch((e) => { if (alive) setErr(String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [date, kind, slug]);

  const pick = (d: string) => { setDate(d); };
  const latest = list.length ? list[list.length - 1] : "";
  const hasPast = list.length > 0;

  return (
    <div ref={box} style={{ margin: "8px 0 2px" }}>
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
              onChange={(e) => pick(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ccc", minWidth: 200, fontWeight: 600, background: "#fff" }}
            >
              <option value="">Select date 选择日期…</option>
              {list.slice().reverse().map((d) => (
                <option key={d} value={d}>{pretty(d)}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => pick(latest)}
              style={{ padding: "6px 12px", borderRadius: 8, border: 0, background: "#cc0000", color: "#fff", fontWeight: 700, cursor: "pointer" }}
            >
              Latest 最新
            </button>
          </>
        ) : (
          <span style={{ color: "#777", fontSize: 13 }}>No past results yet.</span>
        )}
      </div>

      {kind === "kh" ? (
        date ? <CambodiaKhResults date={date} only={KH_GAME[slug]} /> : null
      ) : (
        <>
          {loading ? <div className="alert alert-info mt-3 text-center">Loading past result…</div> : null}
          {err ? <div className="alert alert-warning mt-3 text-center">Could not load the past result.</div> : null}
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
