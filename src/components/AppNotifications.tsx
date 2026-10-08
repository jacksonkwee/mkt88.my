"use client";

import { isCapacitorApp } from "../lib/is-capacitor-app";

import { useEffect } from "react";

const CHANNEL_ID = "mkt88-live-draw";
const NOTIFICATION_1600 = 1600;
const NOTIFICATION_1800 = 1800;
const NOTIFICATION_1830 = 1830;

/** Fingerprint of the reminder plan, so it is only rebuilt when it changes. */
const PLAN_KEY = "mkt_live_notif_plan";

type LocalNotificationsPlugin = {
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

function luckyNumber(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
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
/** Two one-off special draws to remind everyone about. */
const SPECIAL_DATES = [
  { date: "2026-10-27", id: 1700 },
  { date: "2026-12-29", id: 1710 },
];
const SPECIAL_TIMES: [number, number][] = [[12, 0], [15, 0], [18, 10]];
const specialIds = () => SPECIAL_DATES.flatMap((d) => SPECIAL_TIMES.map((_, i) => d.id + i));
const ALL_IDS = [...specialIds(), NOTIFICATION_1600, NOTIFICATION_1800, NOTIFICATION_1830];

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
function localNotifications(): LocalNotificationsPlugin | null {
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
          // v4: the per-game live-result alarms were removed, so every phone
          // re-runs this, cancels the ones it already holds, and keeps only the
          // lucky-number and special-draw reminders.
          const plan = "v4";
          let remembered = "";
          try { remembered = window.localStorage.getItem(PLAN_KEY) || ""; } catch { /* private mode */ }

          const pending = new Set<number>();
          try {
            const got = await ln.getPending?.();
            for (const n of got?.notifications || []) pending.add(Number(n.id));
          } catch { /* no list - rebuild below */ }

          if (remembered === plan && ALL_IDS.every((id) => pending.has(id))) return;

          // Clear our own ids, including any left behind by an older plan.
          await ln.cancel?.({
            notifications: [
              ...Array.from({ length: 200 }, (_, i) => 3000 + i),
              NOTIFICATION_1600,
              NOTIFICATION_1800,
              NOTIFICATION_1830,
            ].map((id) => ({ id })),
          });

          const earlyLucky = luckyNumber();
          const firstLucky = luckyNumber();
          const secondLucky = luckyNumber();
          await ln.schedule?.({
            notifications: [
              {
                id: NOTIFICATION_1600,
                title: "恭喜发财 幸运号码",
                body: `16:00 4D Live 开奖提醒\n幸运号码：${earlyLucky}`,
                largeBody: `16:00 4D Live 开奖提醒\n恭喜发财 幸运号码：${earlyLucky}`,
                channelId: CHANNEL_ID,
                autoCancel: true,
                // The popup reuses this exact number, so what the lock screen
                // showed is what opens with the app.
                extra: { lucky: earlyLucky },
                schedule: { on: { hour: 16, minute: 0 }, repeats: true, allowWhileIdle: true },
              },
              {
                id: NOTIFICATION_1800,
                title: "恭喜发财 幸运号码",
                body: `18:00 4D Live 开奖开始\n幸运号码：${firstLucky}`,
                largeBody: `18:00 4D Live 开奖开始\n恭喜发财 幸运号码：${firstLucky}`,
                channelId: CHANNEL_ID,
                autoCancel: true,
                // The popup reuses this exact number, so what the lock screen
                // showed is what opens with the app.
                extra: { lucky: firstLucky },
                schedule: { on: { hour: 18, minute: 0 }, repeats: true, allowWhileIdle: true },
              },
              {
                id: NOTIFICATION_1830,
                title: "恭喜发财 幸运号码",
                body: `18:30 4D Live 开奖进行中\n幸运号码：${secondLucky}`,
                largeBody: `18:30 4D Live 开奖进行中\n恭喜发财 幸运号码：${secondLucky}`,
                channelId: CHANNEL_ID,
                autoCancel: true,
                // The popup reuses this exact number, so what the lock screen
                // showed is what opens with the app.
                extra: { lucky: secondLucky },
                schedule: { on: { hour: 18, minute: 30 }, repeats: true, allowWhileIdle: true },
              },
              // One-off special draws: 12pm, 3pm and 6:10pm on the date.
              ...SPECIAL_DATES.flatMap((d) => {
                const [y, mo, day] = d.date.split("-").map(Number);
                return SPECIAL_TIMES.map(([h, mi], i) => ({
                  id: d.id + i,
                  title: "Special Draw Today 今天特别彩",
                  body: "Special Draw Today 今天特别彩",
                  largeBody: "Special Draw Today 今天特别彩",
                  channelId: CHANNEL_ID,
                  autoCancel: true,
                  schedule: { on: { year: y, month: mo, day, hour: h, minute: mi }, allowWhileIdle: true },
                }));
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
      if (id !== NOTIFICATION_1600 && id !== NOTIFICATION_1800 && id !== NOTIFICATION_1830) return;
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
