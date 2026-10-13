"use client";

import { useEffect } from "react";
import { isCapacitorApp } from "../lib/is-capacitor-app";
import { localNotifications } from "./AppNotifications";

/**
 * Result-ready reminders.
 *
 * The reminder itself is sent by the server (lib/push-notify.ts), which reaches
 * a phone whose app is fully closed as well as one that is open. This component
 * used to ALSO fire a local notification from the page the moment a game's
 * board started filling - so an open app showed the same draw twice, once from
 * each path, and Perdana with its two draw times was the noisiest of all
 * (reported 13 Oct 2026). The push is now the only sender: one reminder per
 * game per draw, at the game's first number.
 *
 * What is left here is the notification permission the push needs.
 */

/** Shared with the Settings switch in AppHome. "0" = the user switched it off. */
export const RESULT_ALERT_KEY = "mkt_result_alerts";

export default function ResultAlerts({ enabled }: { enabled?: boolean }) {
  // Worked out in the page so one cached copy serves the app and the website.
  const on = enabled ?? isCapacitorApp();

  useEffect(() => {
    if (!on || typeof window === "undefined") return;
    const ln = localNotifications();
    if (!ln) return;
    void (async () => {
      try {
        const before = await ln.checkPermissions?.();
        if (before?.display !== "granted") await ln.requestPermissions?.();
      } catch {
        /* a denied permission must never affect the results */
      }
    })();
  }, [on]);

  return null;
}
