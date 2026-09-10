"use client";

import { useEffect } from "react";

/** Remove 6D 2nd-5th rows from captured past-results HTML. */
export default function PastSixCleanup() {
  useEffect(() => {
    const cleanup = () => {
      document
        .querySelectorAll('[data-id^="d6_first_number_"], [data-id^="d6_second_number_"]')
        .forEach((el) => {
          const id = el.getAttribute("data-id") || "";
          if (/_[2-5]$/.test(id)) el.closest("tr")?.remove();
        });
    };
    cleanup();
    const t = window.setTimeout(cleanup, 600);
    window.addEventListener("load", cleanup);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("load", cleanup);
    };
  }, []);
  return null;
}
