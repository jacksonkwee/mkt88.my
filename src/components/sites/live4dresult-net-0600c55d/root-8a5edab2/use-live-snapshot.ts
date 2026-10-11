"use client";

import { useEffect, useState } from "react";
import { useServerSnapshot } from "../../../LiveSnapshotProvider";
import type { Snap } from "./snapshot-values";

/*
 * overridesFor() and the snapshot types moved to snapshot-values.ts, which is
 * not a client module: the desktop grid is server-rendered and needs the same
 * "which values belong on this card" rule. Re-exported here so the components
 * that already import them from this file keep working.
 */
export { overridesFor } from "./snapshot-values";
export type { HariEntry, PrizeSet, SixEntry, Snap } from "./snapshot-values";

/**
 * The live snapshot the inline boot script already fetched (window.__MKT_SNAP__).
 * Components use it in their first render so React hydration matches the DOM the
 * boot script filled - the current draw shows with no flash and no waiting.
 */
/** Sortable value for a card date like "28-09-2026 (Mon)". */
function dayScore(label?: string): number {
  const m = /(\d{2})-(\d{2})-(\d{4})/.exec(label || "");
  return m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : 0;
}

/**
 * A card never moves backwards to an older draw.
 *
 * While a draw is being revealed the live sources hand back the previous
 * draw for a few seconds. Every direct DOM writer refuses that, but React
 * renders the cards straight from this snapshot, so it had no such rule -
 * which is how a live card flipped to yesterday's finished result (date and
 * all) and then back again.
 */
function keepNewest(prev: Snap, next: Snap): Snap {
  const merged: Snap = { ...prev, ...next };
  const cards: Record<string, Record<string, string>> = { ...(prev.cards || {}), ...(next.cards || {}) };
  for (const [cls, v] of Object.entries(next.cards || {})) {
    const before = prev.cards ? prev.cards[cls] : undefined;
    if (!before) continue;
    const a = dayScore(v.date), b = dayScore(before.date);
    if (a && b && a < b) cards[cls] = before;
  }
  merged.cards = cards;
  return merged;
}

export function useSnap(): Snap {
  const read = (): Snap => {
    if (typeof window === "undefined") return {};
    return ((window as unknown as { __MKT_SNAP__?: Snap }).__MKT_SNAP__) || {};
  };
  const fromServer = useServerSnapshot() as Snap;
  const [snap, setSnap] = useState<Snap>(() => keepNewest(fromServer, read()));
  useEffect(() => {
    const on = () => setSnap((prev) => keepNewest(prev, read()));
    on();
    window.addEventListener("mkt-snap", on);
    return () => window.removeEventListener("mkt-snap", on);
  }, []);
  return snap;
}

