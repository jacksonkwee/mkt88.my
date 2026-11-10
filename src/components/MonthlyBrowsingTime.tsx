"use client";

import { useEffect, useState } from "react";
import { isCapacitorApp } from "../lib/is-capacitor-app";
import { useLang } from "../lib/i18n";

const STORAGE_KEY = "mkt_app_browsing_month";
const MONTH_ZONE = "Asia/Kuala_Lumpur";

type StoredUsage = {
  month: string;
  elapsedMs: number;
};

let usage: StoredUsage | null = null;
let activeSince = 0;
let timer: number | undefined;
let lastPersistMinute = -1;
const listeners = new Set<() => void>();

function monthKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MONTH_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return value("year") + "-" + value("month");
}

function persist(current: StoredUsage): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch { /* storage may be unavailable in private mode */ }
}

function readUsage(now: number): StoredUsage {
  const currentMonth = monthKey(new Date(now));
  let stored: StoredUsage | null = null;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as StoredUsage | null;
    if (parsed && parsed.month === currentMonth && Number.isFinite(parsed.elapsedMs)) stored = parsed;
  } catch { /* replace a broken value with a clean month */ }
  const next = stored || { month: currentMonth, elapsedMs: 0 };
  if (!stored) persist(next);
  return next;
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function tick(): void {
  const now = Date.now();
  if (!usage) usage = readUsage(now);
  const currentMonth = monthKey(new Date(now));
  if (usage.month !== currentMonth) {
    usage = { month: currentMonth, elapsedMs: 0 };
    activeSince = now;
    persist(usage);
    lastPersistMinute = -1;
    emit();
    return;
  }

  if (document.visibilityState === "visible") {
    if (!activeSince) activeSince = now;
    const elapsed = now - activeSince;
    if (elapsed > 0) {
      usage.elapsedMs += elapsed;
      activeSince = now;
      const minute = Math.floor(usage.elapsedMs / 60_000);
      if (minute !== lastPersistMinute) {
        lastPersistMinute = minute;
        persist(usage);
        emit();
      }
    }
  } else {
    activeSince = 0;
  }
}

function onVisibilityChange(): void {
  const now = Date.now();
  if (!usage) usage = readUsage(now);
  if (activeSince) {
    usage.elapsedMs += now - activeSince;
    activeSince = 0;
    persist(usage);
    emit();
  }
  if (document.visibilityState === "visible") {
    activeSince = now;
  }
}

function onPageHide(): void {
  const now = Date.now();
  if (!usage) usage = readUsage(now);
  if (activeSince) {
    usage.elapsedMs += now - activeSince;
    activeSince = 0;
    persist(usage);
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    const now = Date.now();
    if (!usage) usage = readUsage(now);
    activeSince = document.visibilityState === "visible" ? now : 0;
    lastPersistMinute = Math.floor(usage.elapsedMs / 60_000);
    timer = window.setInterval(tick, 1_000);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
  }
  listener();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      tick();
      if (timer) window.clearInterval(timer);
      timer = undefined;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      if (usage) persist(usage);
    }
  };
}

function currentElapsed(): number {
  return usage?.elapsedMs || 0;
}

export default function MonthlyBrowsingTime({ tone = "light" }: { tone?: "light" | "red" }) {
  const [installed, setInstalled] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lang] = useLang();

  useEffect(() => {
    setInstalled(isCapacitorApp());
  }, []);

  useEffect(() => {
    if (!installed) return;
    return subscribe(() => setElapsedMs(currentElapsed()));
  }, [installed]);

  if (!installed) return null;

  const totalMinutes = Math.floor(elapsedMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const label =
    lang === "zh" ? "本月浏览时间" :
    lang === "ms" ? "Masa melayari bulan ini" :
    "Browsing time this month";
  const red = tone === "red";

  return (
    <div
      role="status"
      aria-label={`${label}: ${hours}h ${minutes}m`}
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 28,
        padding: "0 9px",
        borderRadius: 999,
        border: "1px solid " + (red ? "rgba(255,255,255,0.55)" : "var(--j-border-soft, #dedede)"),
        background: red ? "rgba(255,255,255,0.15)" : "#fff",
        color: red ? "#fff" : "var(--brand, #cc0000)",
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        flex: "0 0 auto",
      }}
    >
      <span aria-hidden="true" style={{ marginRight: 4, fontSize: 13 }}>◷</span>
      {String(hours).padStart(2, "0")}h {String(minutes).padStart(2, "0")}m
    </div>
  );
}
