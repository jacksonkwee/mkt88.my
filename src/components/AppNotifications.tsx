"use client";

import { isCapacitorApp } from "../lib/is-capacitor-app";
import {
  LUCKY_ID_BASE,
  LUCKY_ID_RANGE,
  luckyAlarmPlan,
  malaysiaDate,
} from "../lib/lucky-reminders.mjs";

import { useEffect } from "react";

export const CHANNEL_ID = "mkt88-live-draw";
const OLD_LUCKY_IDS = [1600, 1800, 1830];

/** Fingerprint of the reminder plan, so it is only rebuilt when it changes. */
const PLAN_KEY = "mkt_live_notif_plan";

export type LocalNotificationsPlugin = {
  checkPermissions?: () => Promise<{ display?: string }>;
  requestPermissions?: () => Promise<{ display?: string }>;
  createChannel?: (channel: Record<string, unknown>) => Promise<void>;
  cancel?: (options: { notifications: { id: number }[] }) => Promise<void>;
  getPending?: () => Promise<{ notifications?: { id?: number | string }[] }>;
  schedule?: (options: { notifications: Record<string, unknown>[] }) => Promise<unknown>;
  addListener?: (
    eventName: string,
    cb: (data: { notification?: { id?: number | string; body?: string; extra?: { lucky?: unknown } } }) => void
  ) => { remove?: () => void } | undefined;
};

/**
 * This install's own id.
 *
 * It is what makes two phones show different lucky numbers: the number is
 * derived from the day AND this id, so it is stable for the user all day, fresh
 * again tomorrow, and never the same as the next phone's (reported 11 Oct 2026
 * - every user saw the same number, because the seed was only the date).
 */
const DEVICE_KEY = "mkt_device_id";
function deviceId(): string {
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 16);
      window.localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

/*
 * The per-game "live result" alarms are gone.
 *
 * They were fixed clock times - one per game, set for when that draw is
 * normally published - so they rang whether or not the operator had actually
 * published, and the body claimed the result was out when it might not be. A
 * phone alarm cannot know when a result appears.
 *
 * Results are announced from the result itself instead: the app knocks as each
 * number lands while it is open (LiveKnock), and the server-side push planned
 * for the next build will carry the same alert to a locked phone. The old ids
 * are still cancelled below so a phone that installed the old plan clears
 * them.
 */
const SPECIAL_TIMES: [number, number][] = [[12, 0], [15, 0], [18, 10]];
/**
 * The ids a special draw may use: 1700..1999, three alarms per date.
 *
 * The whole range is cancelled whenever the plan is laid down again, so a date
 * the owner removes in /admin cannot leave an alarm behind on any phone.
 */
const SPECIAL_ID_BASE = 1700;
const SPECIAL_ID_RANGE = 300;
export type SpecialAlarm = { id: number; date: string; hour: number; minute: number };

/**
 * The special draw dates, as the owner keeps them in /admin.
 *
 * Nothing is scheduled when this cannot be read: a phone must not be given a
 * special-draw alarm for a date that has since been changed or removed. The
 * plan is re-laid on the first open of every new day, so a failed read repairs
 * itself tomorrow.
 */
async function fetchSpecialDrawDates(): Promise<string[]> {
  try {
    const res = await fetch("/api/site-content", { cache: "no-store" });
    if (!res.ok) return [];
    const j = (await res.json()) as { specialDraws?: unknown };
    const list = Array.isArray(j.specialDraws) ? j.specialDraws : [];
    return list
      .map((d) => String(d || "").trim())
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
  } catch {
    return [];
  }
}

/**
 * The special-draw alarms that have not happened yet.
 *
 * A one-off alarm whose time has gone does not disappear quietly: Android fires
 * it the moment it is laid down, and the plan below is laid down again on the
 * first open of every new day - so a date left in the list rang every day for
 * ever after it had passed (asked to stop 15 Oct 2026). The dates come from
 * /admin, so a new special draw is announced without a code change.
 *
 * Malaysia is UTC+8 all year, so an alarm at 18:10 local is 10:10 UTC.
 */
export function upcomingSpecialAlarms(now = Date.now(), dates: string[] = []): SpecialAlarm[] {
  const out: SpecialAlarm[] = [];
  dates.forEach((date, index) => {
    const [y, mo, day] = date.split("-").map(Number);
    SPECIAL_TIMES.forEach(([hour, minute], slot) => {
      if (Date.UTC(y, mo - 1, day, hour - 8, minute) > now) {
        out.push({ id: SPECIAL_ID_BASE + index * SPECIAL_TIMES.length + slot, date, hour, minute });
      }
    });
  });
  return out;
}
const ALL_IDS = (dates: string[], luckyIds: number[]) => [
  ...upcomingSpecialAlarms(Date.now(), dates).map((a) => a.id),
  ...luckyIds,
];

type CapacitorGlobal = {
  Plugins?: { LocalNotifications?: LocalNotificationsPlugin };
  registerPlugin?: (name: string, impl?: Record<string, unknown>) => LocalNotificationsPlugin;
};

/**
 * Capacitor 6 starts with an empty `Capacitor.Plugins` and only fills it when a
 * plugin's own JavaScript calls `registerPlugin()`. This website never loads
 * `@capacitor/local-notifications` as a bundle, so without the fallback below
 * `Plugins.LocalNotifications` is always undefined and no reminder is ever
 * scheduled. `registerPlugin` is on `window.Capacitor` and builds the native
 * bridge proxy from the plugin headers the Android app injects.
 */
export function localNotifications(): LocalNotificationsPlugin | null {
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap) return null;
  const ready = cap.Plugins?.LocalNotifications;
  if (ready) return ready;
  try {
    const created = cap.registerPlugin?.("LocalNotifications");
    if (!created) return null;
    if (!cap.Plugins) cap.Plugins = {};
    cap.Plugins.LocalNotifications = created;
    return created;
  } catch {
    return null;
  }
}

/**
 * Android app reminders. The app runs the live website in a WebView, so this
 * component talks to the native Local Notifications plugin when available.
 * It schedules two daily Malaysia-time reminders at 18:00 and 18:30.
 */
export default function AppNotifications({ enabled }: { enabled?: boolean }) {
  /*
   * Whether this is the installed app is worked out in the page itself, not by
   * the server, so that one cached copy of the page serves both. This component
   * renders nothing either way, so there is no markup to mismatch.
   */
  const on = enabled ?? isCapacitorApp();
  useEffect(() => {
    if (!on) return;
    let cancelled = false;

    const install = async () => {
      for (let attempt = 0; attempt < 20 && !cancelled; attempt++) {
        const ln = localNotifications();
        if (!ln) {
          await new Promise((r) => setTimeout(r, 750));
          continue;
        }
        try {
          const before = await ln.checkPermissions?.();
          if (before?.display !== "granted") await ln.requestPermissions?.();
          const after = await ln.checkPermissions?.();
          if (after?.display !== "granted") return;

          try {
            await ln.createChannel?.({
              id: CHANNEL_ID,
              name: "MKT88 4D Live Draw",
              description: "Live 4D draw results, all 11 games",
              importance: 5,
              visibility: 1,
              vibration: true,
              lights: true,
              lightColor: "#ffd700",
            });
          } catch { /* already exists or unsupported on this platform */ }

          /*
           * Lay the reminders down once, and only again when the plan changes.
           *
           * Cancelling and re-scheduling them on every app open is what lost
           * reminders: opening the app inside a reminder's own minute makes the
           * plugin look for the NEXT match - tomorrow - so that day's reminder
           * never arrived (reported 5 Oct 2026).
           *
           * But never re-scheduling is wrong too: a reminder left over from an
           * older plan keeps its id, and the plugin treats that id as "already
           * scheduled", so the new time would never be laid down.
           *
           * So the plan itself is fingerprinted and remembered. Same plan and
           * every reminder still pending: leave them all exactly where they
           * are. Different plan, or something missing: clear our ids and lay
           * the whole plan down again, once.
           */
          // v4 removed the per-game live-result alarms. v5 puts the DATE in
          // the fingerprint: the lucky number is derived from the day, so the
          // first open on a new day lays the three reminders down again with
          // that day's numbers instead of repeating yesterday for ever. v6
          // carries the owner's special-draw list too, so adding or removing a
          // date re-lays the alarms the next time the app is opened. v7 lays
          // one-off lucky alarms for 90 days, so a phone that is not opened
          // still gets a different set tomorrow.
          const specialDraws = await fetchSpecialDrawDates();
          const today = malaysiaDate();
          const device = deviceId();
          const luckyPlan = luckyAlarmPlan({ deviceId: device });
          const luckyIds = luckyPlan.map((alarm) => alarm.id);
          const plan = "v7:" + today + ":" + specialDraws.join(",");
          let remembered = "";
          try { remembered = window.localStorage.getItem(PLAN_KEY) || ""; } catch { /* private mode */ }

          const pending = new Set<number>();
          try {
            const got = await ln.getPending?.();
            for (const n of got?.notifications || []) pending.add(Number(n.id));
          } catch { /* no list - rebuild below */ }

          if (remembered === plan && ALL_IDS(specialDraws, luckyIds).every((id) => pending.has(id))) return;

          // Clear our own ids, including any left behind by an older plan.
          await ln.cancel?.({
            notifications: [
              ...Array.from({ length: SPECIAL_ID_RANGE }, (_, i) => SPECIAL_ID_BASE + i),
              ...Array.from({ length: 200 }, (_, i) => 3000 + i),
              ...Array.from({ length: LUCKY_ID_RANGE }, (_, i) => LUCKY_ID_BASE + i),
              ...OLD_LUCKY_IDS,
            ].map((id) => ({ id })),
          });

          // One-off alarms: Android never repeats yesterday's text, even if
          // this phone is not opened again before tomorrow's notifications.
          await ln.schedule?.({
            notifications: [
              ...luckyPlan.map((alarm) => ({
                id: alarm.id,
                title: "恭喜发财 幸运号码",
                body: alarm.body,
                largeBody: alarm.largeBody,
                channelId: CHANNEL_ID,
                autoCancel: true,
                // The popup reuses this exact number, so what the lock screen
                // showed is what opens with the app.
                extra: { lucky: alarm.number },
                schedule: {
                  on: { year: alarm.year, month: alarm.month, day: alarm.day, hour: alarm.hour, minute: alarm.minute },
                  allowWhileIdle: true,
                },
              })),
              // One-off special draws: 12pm, 3pm and 6:10pm on the date - and
              // only the times still ahead of us.
              ...upcomingSpecialAlarms(Date.now(), specialDraws).map((a) => {
                const [y, mo, day] = a.date.split("-").map(Number);
                return {
                  id: a.id,
                  title: "Special Draw Today 今天特别彩",
                  body: "Special Draw Today 今天特别彩",
                  largeBody: "Special Draw Today 今天特别彩",
                  channelId: CHANNEL_ID,
                  autoCancel: true,
                  schedule: { on: { year: y, month: mo, day, hour: a.hour, minute: a.minute }, allowWhileIdle: true },
                };
              }),
            ],
          });
          try { window.localStorage.setItem(PLAN_KEY, plan); } catch { /* private mode */ }
        } catch {
          // Notification failure must never affect the results app.
        }
        return;
      }
    };

    void install();
    return () => { cancelled = true; };
  }, [on]);

  /*
   * Tapping a lucky-number reminder (the 恭喜发财 ones) should land on the main
   * page with the popup already open and showing the SAME number the reminder
   * showed - 1236 on the lock screen opens 1236. The live-draw reminders are
   * deliberately left alone: tapping one just opens the app, so nobody is sent
   * to lucky numbers from a results alert.
   */
  useEffect(() => {
    const ln = localNotifications();
    if (!ln) return;
    const h = ln.addListener?.("localNotificationActionPerformed", (ev) => {
      const id = Number(ev?.notification?.id ?? 0);
      if (id < LUCKY_ID_BASE) return;
      // The number rides along on the notification, so the popup repeats the
      // number the user actually saw instead of drawing a fresh one.
      //
      // Reminders scheduled before this was added carry no extra, so fall back
      // to the number printed in their own text ("... 幸运号码：1236") - the
      // "16:00" style times never look like four digits in a row.
      const n = ev?.notification;
      const sent = (String(n?.extra?.lucky ?? "") || (/(\d{4})/.exec(String(n?.body ?? ""))?.[1] ?? "")).trim();
      window.location.href = /^\d{4}$/.test(sent) ? "/?lucky=" + sent : "/?lucky=1";
    });
    return () => { try { h?.remove?.(); } catch { /* nothing to clean up */ } };
  }, []);

  return null;
}
