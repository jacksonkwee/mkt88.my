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
 * The first render must use exactly the snapshot embedded by the server.
 *
 * The boot script may have received a newer live copy before React starts.
 * Reading that copy during hydration can add markup the server did not render
 * (for example Singapore's Draw No row), forcing React to discard and rebuild
 * the page. Merge the live copy after hydration instead.
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
  /*
   * Perdana and HariHari merge slot by slot too.
   *
   * The server snapshot embedded in the page can carry empty slots while the
   * live data has already arrived, and `{ ...prev, ...next }` let that empty
   * copy overwrite the good one. The card then kept its stale Perdana board -
   * yesterday's numbers under yesterday's date - even after today's 3:30PM
   * result was on the live snapshot (reported 13 Oct 2026). Each slot keeps
   * whichever side holds the newer draw, and never drops one for an empty copy.
   */
  const pickSlot = <T extends { date?: string } | null | undefined>(p?: T, n?: T): T | undefined => {
    if (!n) return p;
    if (!p) return n;
    const a = dayScore(n.date || undefined), b = dayScore(p.date || undefined);
    return a && b && a < b ? p : n;
  };
  const perdana: Record<string, unknown> = { ...(prev.perdana || {}) };
  for (const t of ["15:30", "19:30"]) {
    perdana[t] = pickSlot(prev.perdana ? prev.perdana[t] : null, next.perdana ? next.perdana[t] : null);
  }
  merged.perdana = perdana as Snap["perdana"];
  const hari: Record<string, unknown> = { ...(prev.hari || {}) };
  for (const t of ["15:30", "19:30"]) {
    const p = prev.hari ? prev.hari[t] : null;
    const n = next.hari ? next.hari[t] : null;
    if (!n) { hari[t] = p; continue; }
    if (!p) { hari[t] = n; continue; }
    const a = dayScore((n.set && n.set.date) || undefined), b = dayScore((p.set && p.set.date) || undefined);
    hari[t] = a && b && a < b ? p : { set: n.set || p.set, six: n.six || p.six, jp: n.jp || p.jp };
  }
  merged.hari = hari as Snap["hari"];
  return merged;
}

export function useSnap(): Snap {
  const read = (): Snap => {
    if (typeof window === "undefined") return {};
    return ((window as unknown as { __MKT_SNAP__?: Snap }).__MKT_SNAP__) || {};
  };
  const fromServer = useServerSnapshot() as Snap;
  const [snap, setSnap] = useState<Snap>(fromServer);
  useEffect(() => {
    const on = () => setSnap((prev) => keepNewest(prev, read()));
    on();
    window.addEventListener("mkt-snap", on);
    return () => window.removeEventListener("mkt-snap", on);
  }, []);
  return snap;
}

