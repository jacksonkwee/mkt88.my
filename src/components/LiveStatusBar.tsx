"use client";

import { useEffect, useState } from "react";

/**
 * The one line that says whether anything is happening.
 *
 * Opening the site mid-draw, a player could not tell "this board is still being
 * published" from "this cell is deliberately empty" from "this is yesterday's
 * board" - all three render as `----` - so refreshing the page was their only
 * status signal (design review, 16 Oct 2026). This shows the two facts the page
 * already has: when the server last rebuilt the numbers, and whether a draw is
 * being published now or when the next one starts.
 *
 * The windows are the ones published on /draw-schedule, in Malaysia time. They
 * are duplicated here on purpose: this bar must render instantly from the
 * server HTML and cannot wait for a fetch to know whether we are mid-draw.
 */
const WINDOWS: { days: number[]; from: number; to: number }[] = [
  { days: [0, 1, 2, 3, 4, 5, 6], from: 15 * 60 + 20, to: 16 * 60 + 45 }, // Perdana / HariHari 3:30PM
  { days: [1, 4], from: 18 * 60 + 10, to: 21 * 60 }, // Singapore Toto (Mon, Thu)
  { days: [0, 3, 6], from: 18 * 60 + 30, to: 21 * 60 }, // Singapore 4D, Malaysia 4D
  { days: [0, 1, 2, 3, 4, 5, 6], from: 19 * 60, to: 21 * 60 + 30 }, // Grand Dragon, Nine Lotto, Perdana, HariHari
];

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Malaysia time, as { weekday index, minutes from midnight }. */
function myNow(): { day: number; mins: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kuala_Lumpur", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).map((x) => [x.type, x.value])
  );
  return {
    day: Math.max(0, DAY.indexOf(p.weekday || "")),
    mins: Number(p.hour || 0) * 60 + Number(p.minute || 0),
  };
}

const hhmm = (mins: number) => String(Math.floor(mins / 60)).padStart(2, "0") + ":" + String(mins % 60).padStart(2, "0");

/** Do we fall inside a draw window right now, and if not, when does the next start? */
function drawState(day: number, mins: number): { live: boolean; next: string } {
  for (const w of WINDOWS) if (w.days.includes(day) && mins >= w.from && mins <= w.to) return { live: true, next: "" };
  // The next start today, else the earliest start tomorrow.
  const later = WINDOWS.filter((w) => w.days.includes(day) && w.from > mins).map((w) => w.from);
  if (later.length) return { live: false, next: hhmm(Math.min(...later)) };
  const tomorrow = (day + 1) % 7;
  const starts = WINDOWS.filter((w) => w.days.includes(tomorrow)).map((w) => w.from);
  return { live: false, next: "明天 " + hhmm(Math.min(...starts)) };
}

export default function LiveStatusBar() {
  const [at, setAt] = useState<number | null>(null);
  const [state, setState] = useState(() => {
    const n = myNow();
    return drawState(n.day, n.mins);
  });

  useEffect(() => {
    let alive = true;
    const tick = () => {
      const n = myNow();
      setState(drawState(n.day, n.mins));
    };
    const pull = () =>
      fetch("/api/home-live", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (alive && j && j.at) setAt(j.at); })
        .catch(() => {});
    // The numbers change every few seconds during a draw, so the stamp is read
    // at the same cadence; outside a draw this is one small cached JSON.
    const timer = window.setInterval(() => { tick(); pull(); }, 15000);
    pull();
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  const updated = at
    ? new Date(at).toLocaleTimeString("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "";

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        margin: "10px 0 2px", padding: "8px 12px", borderRadius: 8,
        background: state.live ? "#f0fdf4" : "#fff",
        border: "1px solid " + (state.live ? "#86efac" : "var(--j-border-soft)"),
        fontSize: 13, color: "var(--j-ink)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 9, height: 9, borderRadius: 999, flex: "0 0 auto",
          background: state.live ? "#16a34a" : "#b9b9b9",
        }}
      />
      {state.live ? (
        <strong style={{ color: "#15803d" }}>现场开彩中 · 号码陆续公布</strong>
      ) : (
        <span>等待开彩 · 下一场 <strong>{state.next}</strong></span>
      )}
      <span style={{ marginLeft: "auto", color: "var(--muted)" }}>
        {updated ? "资料更新 " + updated : "读取中…"}
      </span>
    </div>
  );
}
