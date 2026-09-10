"use client";

import { useEffect, useState } from "react";
import { useServerSnapshot } from "../../../LiveSnapshotProvider";


export type PrizeSet = { prize: string[]; special: string[]; cons: string[]; date?: string; drawNo?: string };
export type HariEntry = { set?: PrizeSet | null; six?: { main: string; subs: Record<string, string> } | null; jp?: Record<string, string> | null } | null;
export type Snap = {
  cards?: Record<string, Record<string, string>>;
  perdana?: Record<string, PrizeSet | null>;
  hari?: Record<string, HariEntry>;
};

/**
 * The live snapshot the inline boot script already fetched (window.__MKT_SNAP__).
 * Components use it in their first render so React hydration matches the DOM the
 * boot script filled - the current draw shows with no flash and no waiting.
 */
export function useSnap(): Snap {
  const read = (): Snap => {
    if (typeof window === "undefined") return {};
    return ((window as unknown as { __MKT_SNAP__?: Snap }).__MKT_SNAP__) || {};
  };
  const fromServer = useServerSnapshot() as Snap;
  const [snap, setSnap] = useState<Snap>(() => ({ ...fromServer, ...read() }));
  useEffect(() => {
    const on = () => setSnap((prev) => ({ ...prev, ...read() }));
    on();
    window.addEventListener("mkt-snap", on);
    return () => window.removeEventListener("mkt-snap", on);
  }, []);
  return snap;
}

const timeOf = (id: string) => (id.includes("-1930") ? "19:30" : id.includes("-1530") ? "15:30" : "");
const clean = (v?: string | null) => (v && !/^----+$/.test(v.trim()) ? v.trim() : undefined);

/** Values / prize set that should be rendered for one card. */
export function overridesFor(snap: Snap, cardId: string, tableCls: string): { values?: Record<string, string>; prizeSet?: PrizeSet | null } {
  const cls = (tableCls || "").replace("card outer-box ", "").trim();
  const values: Record<string, string> = { ...((snap.cards && snap.cards[cls]) || {}) };

  const t = timeOf(cardId);
  if (!t) return { values };

  if (cardId.startsWith("table-16")) {
    const set = snap.perdana ? snap.perdana[t] : null;
    if (set) { values.date = clean(set.date) || values.date; values.draw_no = clean(set.drawNo) || values.draw_no; return { values, prizeSet: set }; }
  }
  if (cardId.startsWith("table-15")) {
    const h = snap.hari ? snap.hari[t] : null;
    if (h) {
      if (h.set) { values.date = clean(h.set.date) || values.date; values.draw_no = clean(h.set.drawNo) || values.draw_no; }
      if (h.six && cardId.endsWith("-6d")) {
        if (clean(h.six.main)) values.six_main = h.six.main;
        for (const [k, v] of Object.entries(h.six.subs || {})) { if (clean(v)) values[k] = v; }
      }
      if (h.jp) for (const [k, v] of Object.entries(h.jp)) { if (clean(v)) values[k] = v; }
      if (h.set && !cardId.endsWith("-6d")) return { values, prizeSet: h.set };
    }
  }
  return { values };
}



