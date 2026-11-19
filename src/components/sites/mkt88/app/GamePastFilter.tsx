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

function pretty(iso: string): string {
  const [y, m, d] = iso.split("-");
  const dt = new Date(iso + "T12:00:00");
  const wk = Number.isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US", { weekday: "short" });
  return d + "-" + m + "-" + y + (wk ? " (" + wk + ")" : "");
}

export default function GamePastFilter({ slug, name, kind, dates, tables }: {
  slug: string;
  name: string;
  kind: PastKind;
  dates?: string[];
  tables?: Record<string, string[]>;
}) {
  const wanted = GAME_TABLES[slug] || [];
  const [loadedDates, setLoadedDates] = useState<string[] | null>(null);
  const [datesLoading, setDatesLoading] = useState(false);
  const datesLoadingRef = useRef(false);
  const sourceDates = dates || loadedDates || [];
  // The caller may hand us the exact dates this game has. When it does not,
  // fetch only that game's list after the reader opens the date control.
  const list = useMemo(() => {
    return sourceDates
      .filter((d) => (kind === "kh" ? true : (!tables || !tables[d] || wanted.some((t) => (tables[d] || []).includes(t)))))
      .sort();
  }, [sourceDates, kind, tables, wanted]);

  const [date, setDate] = useState("");
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [inApp, setInApp] = useState(false);
  const [appOpen, setAppOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setInApp(document.body.classList.contains("mkt-in-app")); }, []);

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
  const years = useMemo(
    () => [...new Set(list.map((d) => d.slice(0, 4)))].sort().reverse(),
    [list]
  );
  const activeYear = years.includes(selectedYear) ? selectedYear : (latest.slice(0, 4) || "");
  const months = useMemo(
    () => [...new Set(list.filter((d) => d.startsWith(activeYear + "-")).map((d) => d.slice(0, 7)))].sort().reverse(),
    [list, activeYear]
  );
  const activeMonth = months.includes(selectedMonth) ? selectedMonth : (months[0] || "");
  const monthDates = useMemo(
    () => list.filter((d) => d.startsWith(activeMonth + "-")).sort().reverse(),
    [list, activeMonth]
  );

  const chooseYear = (year: string) => {
    const nextMonths = [...new Set(
      list.filter((d) => d.startsWith(year + "-")).map((d) => d.slice(0, 7))
    )].sort();
    const nextMonth = nextMonths[nextMonths.length - 1] || "";
    const nextDates = list.filter((d) => d.startsWith(nextMonth + "-")).sort();
    setSelectedYear(year);
    setSelectedMonth(nextMonth);
    setDate(nextDates[nextDates.length - 1] || "");
  };

  const chooseMonth = (month: string) => {
    const nextDates = list.filter((d) => d.startsWith(month + "-")).sort();
    setSelectedMonth(month);
    setDate(nextDates[nextDates.length - 1] || "");
  };

  const showLatest = () => {
    setDate("");
    setSelectedYear(latest.slice(0, 4));
    setSelectedMonth(latest.slice(0, 7));
  };

  const loadDates = async () => {
    if (dates || loadedDates !== null || datesLoadingRef.current) return;
    datesLoadingRef.current = true;
    setDatesLoading(true);
    try {
      const res = await fetch("/api/game-past-dates?slug=" + encodeURIComponent(slug), { cache: "force-cache" });
      if (!res.ok) throw new Error("load failed");
      const json = (await res.json()) as { dates?: string[] };
      setLoadedDates(Array.isArray(json.dates) ? json.dates : []);
    } catch {
      setLoadedDates([]);
    } finally {
      datesLoadingRef.current = false;
      setDatesLoading(false);
    }
  };

  const toggleDateList = () => {
    setAppOpen((open) => {
      if (!open) void loadDates();
      return !open;
    });
  };

  return (
    <div ref={rootRef} style={{ margin: "2px 0 2px" }}>
      <div className={"mkt-past-filter-bar" + (inApp && appOpen ? " mkt-past-filter-open" : "")}
        style={{
          border: "1px solid var(--j-border)", borderRadius: 10, background: "#fff",
          padding: "8px 10px", display: "flex", flexWrap: "wrap", gap: 8,
          alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        {/*
         * The date list is behind this button on the website too, not only in
         * the app.
         *
         * It used to be laid out on the page: a 41-option select, one per card,
         * sitting above every board - on the desktop home that was eleven of
         * them, all of it above the numbers a player came for (design review,
         * 16 Oct 2026). The control is unchanged; it simply appears when asked
         * for. A player who never opens it never pays for it.
         */}
        <button
          type="button"
          className="mkt-past-filter-title"
          onClick={toggleDateList}
          style={{ color: "#cc0000", fontSize: 15, fontWeight: 700, background: "transparent", border: 0, padding: "8px 4px", cursor: "pointer", whiteSpace: "nowrap" }}
          aria-expanded={appOpen}
        >
          {name} Past Result 过去开彩
        </button>
        {datesLoading ? (
          <span style={{ color: "var(--muted)", fontSize: 13 }}>Loading dates…</span>
        ) : hasPast ? (
          <>
            {appOpen ? <>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600 }}>
                Year 年份
                <select
                  aria-label={"Past result year for " + name}
                  value={activeYear}
                  onChange={(e) => chooseYear(e.target.value)}
                  style={{ padding: "6px 8px", minHeight: 44, borderRadius: 8, border: "1px solid var(--j-border)", fontWeight: 700, background: "#fff" }}
                >
                  {years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600 }}>
                Month 月份
                <select
                  aria-label={"Past result month for " + name}
                  value={activeMonth}
                  onChange={(e) => chooseMonth(e.target.value)}
                  style={{ padding: "6px 8px", minHeight: 44, borderRadius: 8, border: "1px solid var(--j-border)", fontWeight: 700, background: "#fff" }}
                >
                  {months.map((month) => <option key={month} value={month}>{month.slice(5)}</option>)}
                </select>
              </span>
              <select
                className="mkt-past-filter-select"
                aria-label={"Past result date for " + name}
                value={date}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setDate(nextDate);
                  if (nextDate) {
                    setSelectedYear(nextDate.slice(0, 4));
                    setSelectedMonth(nextDate.slice(0, 7));
                  }
                }}
                style={{ padding: "6px 10px", minHeight: 44, borderRadius: 8, border: "1px solid var(--j-border)", minWidth: 190, fontWeight: 600, background: "#fff" }}
              >
                <option value="">Live results (latest) 最新开奖</option>
                {monthDates.map((d) => (
                  <option key={d} value={d}>{pretty(d)}</option>
                ))}
              </select>
            </> : null}

            {!inApp ? (
              <>
                <button
                  type="button"
                  className="mkt-past-filter-latest"
                  onClick={() => setDate(latest)}
                  style={{ padding: "6px 12px", minHeight: 44, borderRadius: 8, border: 0, background: "#cc0000", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
                >
                  Latest 最新
                </button>
              </>
            ) : null}
          </>
        ) : loadedDates !== null ? (
          <span style={{ color: "var(--muted)", fontSize: 13 }}>No past results yet.</span>
        ) : null}
      </div>

      {date ? (
        <div className="text-center" style={{ margin: "6px 0 -2px", fontSize: 13, color: "#0a6b2d" }}>
          Showing past result for <strong>{pretty(date)}</strong>
          {" · "}
          <a href="#" onClick={(e) => { e.preventDefault(); showLatest(); }} style={{ color: "#cc0000", fontWeight: 700 }}>
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
