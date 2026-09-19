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
    // The phone swipe track renders every game's card at once. This filter only
    // exists to knock the desktop snapshot down to the chosen operator, so it
    // must leave the track alone - hiding those cards blanks every other game's
    // slide for the rest of the session.
    const cards = [...document.querySelectorAll(".card.outer-box")].filter(
      (c) => !c.closest(".mkt-pager-track")
    );
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
