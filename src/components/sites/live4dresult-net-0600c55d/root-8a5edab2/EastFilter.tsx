"use client";

import { useEffect } from "react";

const OP_TO_TABLE: Record<string, string> = {
  sandakan: "table-8",
  cashsweep: "table-9",
  sabah88: "table-10",
};

/** Hides the other East operators when the page is opened with ?op=... */
export default function EastFilter() {
  useEffect(() => {
    const op = new URLSearchParams(window.location.search).get("op");
    const table = op ? OP_TO_TABLE[op] : null;
    if (!table) return;
    const cards = [...document.querySelectorAll(".card.outer-box")];
    let shown: HTMLElement | null = null;
    for (const c of cards) {
      if (c.className.includes(table)) { shown = c as HTMLElement; continue; }
      (c as HTMLElement).style.display = "none";
    }
    // Match the same column size/location as the other single-game pages.
    if (shown && shown.parentElement) {
      const p = shown.parentElement;
      p.className = "col-12 col-sm-12 col-md-8 col-lg-7 mx-auto mt-3 px-1";
    }
  }, []);
  return null;
}
