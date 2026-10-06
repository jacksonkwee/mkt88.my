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

/**
 * Live-result notifications, one per game, fired by Android itself - so the
 * phone sounds and vibrates even when the screen is locked or the app is
 * closed. A web page cannot do that; only the native alarm can.
 *
 * Times are Malaysia time and follow each operator's draw days:
 *   Wed / Sat / Sun - the Malaysia 4D games and Sports Toto
 *                     (no Monday draw for any of them)
 *   every day       - Grand Dragon, Nine Lotto, Perdana, Lucky HariHari
 * 1 = Sunday ... 7 = Saturday (Capacitor's weekday numbering).
 */
const WED_SAT_SUN = [4, 7, 1];
const EVERY_DAY = [0];

/*
 * One reminder per game per draw, timed for when that draw is normally
 * published rather than when it is drawn - the earlier times rang while the
 * board was still empty, and Perdana and HariHari only had their afternoon
 * draw listed at all, so their 7:30pm results never rang.
 */
const LIVE_GAMES: { name: string; zh: string; days: number[]; hour: number; minute: number }[] = [
  { name: "Magnum 4D", zh: "萬能", days: WED_SAT_SUN, hour: 19, minute: 25 },
  { name: "Magnum Life", zh: "万能天天彩", days: WED_SAT_SUN, hour: 19, minute: 27 },
  { name: "Magnum Jackpot Gold", zh: "萬能黃金万字积宝", days: WED_SAT_SUN, hour: 19, minute: 29 },
  { name: "Da Ma Cai 1+3D", zh: "大馬彩", days: WED_SAT_SUN, hour: 19, minute: 31 },
  { name: "Da Ma Cai 3+3D", zh: "大馬彩", days: WED_SAT_SUN, hour: 19, minute: 33 },
  { name: "Singapore 4D", zh: "新加坡", days: WED_SAT_SUN, hour: 19, minute: 35 },
  { name: "Sabah 88 4D", zh: "沙巴88", days: WED_SAT_SUN, hour: 19, minute: 37 },
  { name: "Sandakan 4D", zh: "山打根", days: WED_SAT_SUN, hour: 19, minute: 39 },
  { name: "Special Cash Sweep", zh: "沙捞越", days: WED_SAT_SUN, hour: 19, minute: 41 },
  { name: "Sports Toto 4D", zh: "多多", days: WED_SAT_SUN, hour: 19, minute: 43 },
  { name: "Sports Toto 5D / 6D", zh: "多多六合彩", days: WED_SAT_SUN, hour: 19, minute: 45 },
  { name: "Grand Dragon 4D", zh: "豪龙", days: EVERY_DAY, hour: 20, minute: 0 },
  { name: "Nine Lotto", zh: "开彩", days: EVERY_DAY, hour: 20, minute: 2 },
  // Perdana dropped its 3:30PM draw on 1 Oct 2026, so only the 7:30PM draw rings.
  { name: "Perdana 4D", zh: "Perdana", days: EVERY_DAY, hour: 19, minute: 50 },
  { name: "Lucky HariHari 4D", zh: "天天好运", days: EVERY_DAY, hour: 15, minute: 47 },
  { name: "Lucky HariHari 4D", zh: "天天好运", days: EVERY_DAY, hour: 19, minute: 52 },
];

/** Stable ids so a later launch can cancel exactly what it scheduled. */
function liveIds(): number[] {
  const ids: number[] = [];
  LIVE_GAMES.forEach((g, gi) => g.days.forEach((_, di) => ids.push(3000 + gi * 10 + di)));
  return ids;
}
/** Two one-off special draws to remind everyone about. */
const SPECIAL_DATES = [
  { date: "2026-10-27", id: 1700 },
  { date: "2026-12-29", id: 1710 },
];
const SPECIAL_TIMES: [number, number][] = [[12, 0], [15, 0], [18, 10]];
const specialIds = () => SPECIAL_DATES.flatMap((d) => SPECIAL_TIMES.map((_, i) => d.id + i));
const ALL_IDS = [...liveIds(), ...specialIds(), NOTIFICATION_1600, NOTIFICATION_1800, NOTIFICATION_1830];

function LIVE_GAME_SCHEDULE(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  LIVE_GAMES.forEach((g, gi) => {
    g.days.forEach((weekday, di) => {
      const at = String(g.hour).padStart(2, "0") + ":" + String(g.minute).padStart(2, "0");
      const body = `${g.name} 开奖成绩已出炉 — 点开查看最新结果`;
      out.push({
        id: 3000 + gi * 10 + di,
        title: `${g.name} ${g.zh} Live Result`,
        body,
        largeBody: `${at}  ${body}`,
        channelId: CHANNEL_ID,
        autoCancel: true,
        schedule: {
          on: weekday === 0 ? { hour: g.hour, minute: g.minute } : { weekday, hour: g.hour, minute: g.minute },
          repeats: true,
          allowWhileIdle: true,
        },
      });
    });
  });
  return out;
}

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
          const plan =
            // v3: the two special-draw reminders were added, so every phone
            // lays its reminders down once more and picks them up.
            "v3|" + LIVE_GAMES.map((g) => g.days.join("") + "@" + g.hour + ":" + g.minute).join("|");
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
              ...LIVE_GAME_SCHEDULE(),
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
