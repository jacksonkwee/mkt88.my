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
 * This is the half that runs inside the app. A phone whose app is fully closed
 * is woken by the server-side push in lib/push-notify.ts instead - together the
 * two cover every case, which is why the Settings text no longer says "while
 * the app is running".
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

/** The cells that show a drawn number, as printed by the operator. */
const DRAWN = /^\d{1,6}$/;

/**
 * Which days each game runs and the window its numbers are being published in,
 * Malaysia time. Same table as the server-side reminder in lib/push-notify.ts.
 *
 * Without it a card that merely carried today's date was enough to fire, so on
 * a Monday - when only the daily Cambodia games and Singapore Toto draw - the
 * app still buzzed for Malaysia, Singapore and East Malaysia (reported 12 Oct
 * 2026). Wednesday = 3, Sunday = 0.
 */
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WSS_DAYS = [0, 3, 6];   // Wednesday, Saturday, Sunday
const TOTO_DAYS = [1, 4];     // Monday, Thursday
const DRAW_WINDOW: Record<string, { days: number[]; from: number; to: number }> = {
  "table-13": { days: ALL_DAYS, from: 19 * 60, to: 21 * 60 + 30 },
  "table-17": { days: ALL_DAYS, from: 19 * 60, to: 21 * 60 + 30 },
  "table-15": { days: ALL_DAYS, from: 15 * 60 + 20, to: 21 * 60 + 30 },
  "table-16": { days: ALL_DAYS, from: 15 * 60 + 20, to: 21 * 60 + 30 },
  "table-1": { days: WSS_DAYS, from: 18 * 60 + 50, to: 21 * 60 },
  "table-2": { days: WSS_DAYS, from: 18 * 60 + 50, to: 21 * 60 },
  "table-3": { days: WSS_DAYS, from: 18 * 60 + 50, to: 21 * 60 },
  "table-4": { days: WSS_DAYS, from: 18 * 60 + 50, to: 21 * 60 },
  "table-5": { days: WSS_DAYS, from: 18 * 60 + 50, to: 21 * 60 },
  "table-6": { days: WSS_DAYS, from: 18 * 60 + 50, to: 21 * 60 },
  "table-7": { days: WSS_DAYS, from: 18 * 60 + 50, to: 21 * 60 },
  "table-8": { days: WSS_DAYS, from: 18 * 60 + 50, to: 21 * 60 },
  "table-9": { days: WSS_DAYS, from: 18 * 60 + 50, to: 21 * 60 },
  "table-10": { days: WSS_DAYS, from: 18 * 60 + 50, to: 21 * 60 },
  "table-11": { days: WSS_DAYS, from: 18 * 60 + 10, to: 21 * 60 },
  "table-12": { days: TOTO_DAYS, from: 18 * 60 + 10, to: 21 * 60 },
};

/** Today in Malaysia as "weekday index, minutes from midnight". */
function myNow(): { day: number; mins: number } {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kuala_Lumpur", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    const day = Math.max(0, ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday || ""));
    return { day, mins: Number(p.hour || 0) * 60 + Number(p.minute || 0) };
  } catch {
    const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
    return { day: d.getUTCDay(), mins: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }
}

/**
 * The game's own draw day and window. A card can only be on today's draw while
 * that game is actually running, so a game outside its window never alerts.
 */
function inDrawWindow(gameClass: string, now = myNow()): boolean {
  const win = DRAW_WINDOW[gameClass];
  if (!win) return true;   // unknown game: fall back to the date check alone
  return win.days.includes(now.day) && now.mins >= win.from && now.mins <= win.to;
}

/**
 * The window one Perdana / HariHari slot runs in ("3:30PM" or "7:30PM").
 *
 * Those boards keep today's date for the rest of the day, so the whole
 * 3:30PM-9:30PM span would still count as "live" at 8:45PM and buzz for a draw
 * that finished hours earlier. Each slot is only live around its own time.
 */
function inSlotWindow(card: Element, now = myNow()): boolean {
  const title = (card.querySelector(".lottery-name")?.textContent || card.textContent || "");
  const slot = /3\s*:?\s*30/i.test(title) ? "15:30" : /7\s*:?\s*30/i.test(title) ? "19:30" : "";
  if (slot === "15:30") return now.mins >= 15 * 60 + 20 && now.mins <= 16 * 60 + 45;
  if (slot === "19:30") return now.mins >= 19 * 60 + 20 && now.mins <= 21 * 60 + 30;
  return true;
}

/**
 * Every game on this page whose draw has STARTED.
 *
 * Waiting for the 1st/2nd/3rd prizes meant the reminder arrived at the END of a
 * draw - a 3:30PM Lucky draw was announced at 4:08PM (reported 12 Oct 2026).
 * The 4D games publish their special numbers first, so the first number to
 * appear on the board is the moment to tell the user about.
 */
function readyGames(): Ready[] {
  const out: Ready[] = [];
  const now = myNow();
  for (const card of Array.from(document.querySelectorAll(".card.outer-box:not(.mkt-past)"))) {
    // "card outer-box table-13"; the schedule is keyed on the game's class.
    const cls = (card.className.match(/table-\d+/) || [""])[0];
    if (cls === "table-15" || cls === "table-16") {
      if (!inSlotWindow(card, now)) continue;
    } else if (!inDrawWindow(cls, now)) {
      continue;
    }
    // Cards with no prize rows (the 6D and jackpot boards) have nothing to wait for.
    if (!card.querySelector('[data-id="first_prize"]')) continue;
    const date = (card.querySelector('[data-id="date"]')?.textContent || "").trim();
    if (!/^\d{2}-\d{2}-\d{4}/.test(date)) continue;
    const ids = [...PRIZES];
    for (let i = 1; i <= 15; i++) ids.push("special-" + i);
    for (let i = 1; i <= 10; i++) ids.push("consolation-" + i);
    const started = ids.some((id) => DRAWN.test((card.querySelector('[data-id="' + id + '"]')?.textContent || "").trim()));
    if (!started) continue;
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
                    body: tr("resultLive", lang),
                    largeBody: g.name + "\n" + tr("resultLive", lang),
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
