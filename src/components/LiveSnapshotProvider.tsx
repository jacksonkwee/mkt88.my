"use client";

import { createContext, useContext, useEffect, useState } from "react";
export type SnapValue = {
  cards?: Record<string, Record<string, string>>;
  perdana?: Record<string, { prize: string[]; special: string[]; cons: string[]; date?: string; drawNo?: string } | null>;
  hari?: Record<string, unknown>;
};
type Snap = SnapValue;

const Ctx = createContext<Snap>({});

/**
 * Shares the server-rendered snapshot with every client component, so their
 * first render already contains the current draw (hydration matches the HTML -
 * no flash of the old numbers).
 */
export default function LiveSnapshotProvider({ value, children }: { value: Snap; children: React.ReactNode }) {
  const [snap, setSnap] = useState<Snap>(value || {});
  useEffect(() => {
    const merge = () => {
      const w = (window as unknown as { __MKT_SNAP__?: Snap }).__MKT_SNAP__;
      if (w) setSnap((prev) => ({ ...prev, ...w }));
    };
    merge();
    window.addEventListener("mkt-snap", merge);
    return () => window.removeEventListener("mkt-snap", merge);
  }, []);
  return <Ctx.Provider value={snap}>{children}</Ctx.Provider>;
}

export function useServerSnapshot(): Snap {
  return useContext(Ctx);
}

