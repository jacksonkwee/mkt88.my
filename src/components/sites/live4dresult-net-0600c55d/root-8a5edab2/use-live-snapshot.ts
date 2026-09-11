"use client";

import { useEffect, useState } from "react";
import { useServerSnapshot } from "../../../LiveSnapshotProvider";


export type PrizeSet = { prize: string[]; special: string[]; cons: string[]; date?: string; drawNo?: string };
export type HariEntry = { set?: PrizeSet | null; six?: { main: string; subs: Record<string, string> } | null; jp?: Record<string, string> | null } | null;
export type SixEntry = { main: string; subs: Record<string, string> } | null;
export type Snap = {
  cards?: Record<string, Record<string, string>>;
  perdana?: Record<string, PrizeSet | null>;
  hari?: Record<string, HariEntry>;
  gd6?: SixEntry;
  gdjp7?: Record<string, string> | null;
  nine6?: SixEntry;
  nineJp?: Record<string, string> | null;
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
const six6 = (v?: string) => (v && !/^----+$/.test(v.trim()) ? v : "----");

/** Write the 6D 2nd-5th rows as "<first half> or <second half>". */
function sixSubs(values: Record<string, string>, subs?: Record<string, string>) {
  if (!subs) return;
  for (const n of [2, 3, 4, 5]) {
    const a = subs["six_" + n + "a"];
    const b = subs["six_" + n + "b"];
    if (!clean(a) && !clean(b)) continue;
    values["six_" + n] = six6(a) + " or " + six6(b);
  }
}

/** Values / prize set that should be rendered for one card. */
export function overridesFor(snap: Snap, cardId: string, tableCls: string): { values?: Record<string, string>; prizeSet?: PrizeSet | null } {
  const cls = (tableCls || "").replace("card outer-box ", "").replace(" six-jp", "").trim();
  const cleanCardId = cardId.replace(/-jp$/, "");
  const values: Record<string, string> = { ...((snap.cards && snap.cards[cls]) || {}) };

  if (cleanCardId.startsWith("table-14")) {
    // The 4D card carries the authoritative draw date for this game.
    const gd4 = snap.cards ? snap.cards["table-13"] : null;
    if (gd4 && clean(gd4.date)) values.date = gd4.date;
    const g = snap.gd6;
    if (g) { if (clean(g.main)) values.six_main = g.main; sixSubs(values, g.subs); }
    if (snap.gdjp7) for (const [k, v] of Object.entries(snap.gdjp7)) { if (clean(v)) values[k] = v; }
    return { values };
  }
  if (cleanCardId.startsWith("table-18")) {
    const nine4 = snap.cards ? snap.cards["table-17"] : null;
    if (nine4 && clean(nine4.date)) values.date = nine4.date;
    const n = snap.nine6;
    if (n) { if (clean(n.main)) values.six_main = n.main; sixSubs(values, n.subs); }
    if (snap.nineJp) for (const [k, v] of Object.entries(snap.nineJp)) { if (clean(v)) values[k] = v; }
    return { values };
  }

  const t = timeOf(cleanCardId);
  if (!t) return { values };

  if (cleanCardId.startsWith("table-16")) {
    const set = snap.perdana ? snap.perdana[t] : null;
    if (set) { values.date = clean(set.date) || values.date; values.draw_no = clean(set.drawNo) || values.draw_no; return { values, prizeSet: set }; }
  }
  if (cleanCardId.startsWith("table-15")) {
    const h = snap.hari ? snap.hari[t] : null;
    if (h) {
      if (h.set) { values.date = clean(h.set.date) || values.date; values.draw_no = clean(h.set.drawNo) || values.draw_no; }
      if (h.six && cleanCardId.endsWith("-6d")) {
        if (clean(h.six.main)) values.six_main = h.six.main;
        for (const [k, v] of Object.entries(h.six.subs || {})) { if (clean(v)) values[k] = v; }
        sixSubs(values, h.six.subs);
      }
      if (h.jp) for (const [k, v] of Object.entries(h.jp)) { if (clean(v)) values[k] = v; }
      if (h.set && !cleanCardId.endsWith("-6d")) return { values, prizeSet: h.set };
    }
  }
  return { values };
}
