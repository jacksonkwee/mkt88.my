"use client";

import { useEffect } from "react";
import { isCapacitorApp } from "../lib/is-capacitor-app";
import { useLang, tr } from "../lib/i18n";
import { CHANNEL_ID, localNotifications } from "./AppNotifications";

/**
 * "Result ready" reminder for each game, carrying the game's own name.
 *
 * The phone cannot be told by an alarm when a draw is out - only the result
 * itself knows. So the reminder is fired from the result: the page is already
 * polling the live snapshot while the app is open, and the moment a game's
 * 1st/2nd/3rd prizes are all published a notification goes out for that game
 * ("Magnum 4D 万能 - 成绩已出炉"). One per game per draw, never repeated.
 *
 * Only while the app is running: a phone that has the app fully closed needs a
 * server-side push (Firebase) to be woken, which is a separate job.
 *
 * The switch lives in the app's Settings page ("成绩出炉提醒"); the first pass
 * after opening only records what is already finished, so opening the app in
 * the evening does not fire a dozen alerts for results that came out hours ago.
 */

/** Shared with the Settings switch in AppHome. "0" = the user switched it off. */
export const RESULT_ALERT_KEY = "mkt_result_alerts";

/** Games already announced, as "<card id>|<draw date>". */
const SENT_KEY = "mkt_result_alerts_sent";
const SENT_KEEP = 300;
const PRIZES = ["first_prize", "second_prize", "third_prize"];
/** How long to wait for the page's live numbers before priming. */
const SETTLE_MS = 15000;

function alertsOn(): boolean {
  try { return window.localStorage.getItem(RESULT_ALERT_KEY) !== "0"; } catch { return true; }
}

function loadSent(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SENT_KEY);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

function saveSent(sent: Set<string>): void {
  try { window.localStorage.setItem(SENT_KEY, JSON.stringify([...sent].slice(-SENT_KEEP))); } catch { /* private mode */ }
}

type Ready = { key: string; name: string };

/** Every game on this page whose 1st, 2nd and 3rd prizes are all published. */
function readyGames(): Ready[] {
  const out: Ready[] = [];
  for (const card of Array.from(document.querySelectorAll(".card.outer-box:not(.mkt-past)"))) {
    // Cards with no prize rows (the 6D and jackpot boards) have nothing to wait for.
    if (!card.querySelector('[data-id="first_prize"]')) continue;
    const date = (card.querySelector('[data-id="date"]')?.textContent || "").trim();
    if (!/^\d{2}-\d{2}-\d{4}/.test(date)) continue;
    const all = PRIZES.every((id) => /^\d{3,6}$/.test((card.querySelector('[data-id="' + id + '"]')?.textContent || "").trim()));
    if (!all) continue;
    const name = (card.querySelector(".lottery-name")?.textContent || "").replace(/\s+/g, " ").trim();
    if (!name) continue;
    out.push({ key: (card.id || name) + "|" + date, name });
  }
  return out;
}

export default function ResultAlerts({ enabled }: { enabled?: boolean }) {
  // Worked out in the page so one cached copy serves the app and the website.
  const on = enabled ?? isCapacitorApp();
  const [lang] = useLang();

  useEffect(() => {
    if (!on) return;
    if (typeof window === "undefined") return;

    let cancelled = false;
    const sent = loadSent();
    const startedAt = Date.now();
    let primed = false;
    let seq = 0;

    /** Ask for the notification permission, once, if it is not already given. */
    const permitted = async () => {
      const ln = localNotifications();
      if (!ln) return null;
      try {
        const before = await ln.checkPermissions?.();
        if (before?.display !== "granted") await ln.requestPermissions?.();
        const after = await ln.checkPermissions?.();
        return after?.display === "granted" ? ln : null;
      } catch {
        return null;
      }
    };

    const tick = async () => {
      if (cancelled) return;
      const ready = readyGames();
      // Wait for the live numbers to land before deciding what was already out
      // when the app opened.
      if (!primed && !ready.length && Date.now() - startedAt < SETTLE_MS) return;
      const fresh = ready.filter((g) => !sent.has(g.key));
      if (fresh.length) {
        if (primed && alertsOn()) {
          const ln = await permitted();
          if (ln) {
            for (const g of fresh) {
              try {
                await ln.schedule?.({
                  notifications: [{
                    id: 4000 + ((Date.now() + seq++ * 13) % 2000000),
                    title: g.name,
                    body: tr("resultReady", lang),
                    largeBody: g.name + "\n" + tr("resultReady", lang),
                    channelId: CHANNEL_ID,
                    autoCancel: true,
                    schedule: { at: new Date(Date.now() + 400) },
                  }],
                });
              } catch { /* a failed alert must never affect the results */ }
            }
          }
        }
        for (const g of fresh) sent.add(g.key);
        saveSent(sent);
      }
      primed = true;
    };

    void tick();
    const timer = window.setInterval(() => { void tick(); }, 4000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [on, lang]);

  return null;
}
