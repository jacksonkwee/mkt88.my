"use client";

import { useEffect, useState } from "react";
import { nightDrawFirst } from "./draw-order";

/** Re-checks the draw slot every minute so the columns flip at 7:30pm and again
 *  at 3:30pm the next day, when the new 3:30 result is published. */
export function useDrawOrder(): boolean {
  const [night, setNight] = useState(() => nightDrawFirst());
  useEffect(() => {
    const t = window.setInterval(() => setNight(nightDrawFirst()), 60000);
    return () => window.clearInterval(t);
  }, []);
  return night;
}
