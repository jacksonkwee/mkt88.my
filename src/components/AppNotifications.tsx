"use client";

import { isCapacitorApp } from "../lib/is-capacitor-app";

import { useEffect } from "react";

export const CHANNEL_ID = "mkt88-live-draw";
const NOTIFICATION_1600 = 1600;
const NOTIFICATION_1800 = 1800;
const NOTIFICATION_1830 = 1830;

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

/** The Malaysia date, so the number turns over at local midnight. */
function myToday(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/*
 * The number belongs to the DAY.
 *
 * An Android repeating notification repeats its text verbatim, so a number
 * drawn once when the plan was laid down said the same thing every morning -
 * the same number as yesterday (reported 9 Oct 2026). It is derived from the
 * date instead, and the plan below carries that date, so the first open on a
 * new day lays the three reminders down again with that day's numbers.
 */
function luckyNumber(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return String((h >>> 0) % 10000).padStart(4, "0");
}

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

/** The three numbers of one day, forced apart from each other. */
function dailyLuckyNumbers(seed: string): [string, string, string] {
  const out: string[] = [luckyNumber(seed + "|16:00")];
  for (const slot of ["|18:00", "|18:30"]) {
    let n = luckyNumber(seed + slot);
    let guard = 0;
    while (out.includes(n) && guard++ < 10000) n = String((Number(n) + 7) % 10000).padStart(4, "0");
    out.push(n);
  }
  return out as [string, string, string];
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
export type SpecialAlarm = { id: number; date: string; hour: number; minute: number };

/**
 * The special-draw alarms that have not happened yet.
 *
 * A one-off alarm whose time has gone does not disappear quietly: Android fires
 * it the moment it is laid down, and the plan below is laid down again on the
 * first open of every new day - so a date left in the list rang every day for
 * ever after it had passed (asked to stop 15 Oct 2026). New special draws go
 * into SPECIAL_DATES above; nothing else has to change.
 *
 * Malaysia is UTC+8 all year, so an alarm at 18:10 local is 10:10 UTC.
 */
export function upcomingSpecialAlarms(now = Date.now()): SpecialAlarm[] {
  const out: SpecialAlarm[] = [];
  for (const d of SPECIAL_DATES) {
    const [y, mo, day] = d.date.split("-").map(Number);
    SPECIAL_TIMES.forEach(([hour, minute], i) => {
      if (Date.UTC(y, mo - 1, day, hour - 8, minute) > now) out.push({ id: d.id + i, date: d.date, hour, minute });
    });
  }
  return out;
}
const ALL_IDS = () => [
  ...upcomingSpecialAlarms().map((a) => a.id),
  NOTIFICATION_1600, NOTIFICATION_1800, NOTIFICATION_1830,
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
          // that day's numbers instead of repeating yesterday for ever.
          const today = myToday();
          const plan = "v5:" + today;
          let remembered = "";
          try { remembered = window.localStorage.getItem(PLAN_KEY) || ""; } catch { /* private mode */ }

          const pending = new Set<number>();
          try {
            const got = await ln.getPending?.();
            for (const n of got?.notifications || []) pending.add(Number(n.id));
          } catch { /* no list - rebuild below */ }

          if (remembered === plan && ALL_IDS().every((id) => pending.has(id))) return;

          // Clear our own ids, including any left behind by an older plan.
          await ln.cancel?.({
            notifications: [
              ...Array.from({ length: 200 }, (_, i) => 3000 + i),
              NOTIFICATION_1600,
              NOTIFICATION_1800,
              NOTIFICATION_1830,
            ].map((id) => ({ id })),
          });

          // Per user, per day, and the three of them different from each other.
          const [earlyLucky, firstLucky, secondLucky] = dailyLuckyNumbers(deviceId() + "|" + today);
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
              // One-off special draws: 12pm, 3pm and 6:10pm on the date - and
              // only the times still ahead of us.
              ...upcomingSpecialAlarms().map((a) => {
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
