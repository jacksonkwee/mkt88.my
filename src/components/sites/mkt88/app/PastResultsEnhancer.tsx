"use client";

import { useEffect } from "react";

/**
 * Adds the missing live behaviour to the static Past Results toolbar:
 * picking "Cambodia" opens the Cambodia results page; picking
 * "Malaysia & Singapore" re-opens Past Results.
 */
export default function PastResultsEnhancer() {
  useEffect(() => {
    const wire = (id: string, href: string) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (!el) return;
      const go = () => {
        window.location.href = href;
      };
      el.addEventListener("change", go);
      return () => el.removeEventListener("change", go);
    };
    const un1 = wire("selcam", "/cambodia-4d-results");
    const un2 = wire("selmy", "/past-results");
    return () => {
      if (un1) un1();
      if (un2) un2();
    };
  }, []);
  return null;
}
