"use client";

import { useEffect } from "react";

const CHANNEL_ID = "mkt88-live-draw";
const NOTIFICATION_1800 = 1800;
const NOTIFICATION_1830 = 1830;

type LocalNotificationsPlugin = {
  checkPermissions?: () => Promise<{ display?: string }>;
  requestPermissions?: () => Promise<{ display?: string }>;
  createChannel?: (channel: Record<string, unknown>) => Promise<void>;
  cancel?: (options: { notifications: { id: number }[] }) => Promise<void>;
  schedule?: (options: { notifications: Record<string, unknown>[] }) => Promise<unknown>;
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
 *   Wed / Sat / Sun - the Malaysia 4D games (they draw on those days)
 *   Mon / Wed / Sat - Sports Toto
 *   every day       - Grand Dragon, Nine Lotto, Perdana, Lucky HariHari
 * 1 = Sunday ... 7 = Saturday (Capacitor's weekday numbering).
 */
const WED_SAT_SUN = [4, 7, 1];
const MON_WED_SAT = [2, 4, 7];
const EVERY_DAY = [0];

const LIVE_GAMES: { name: string; zh: string; days: number[]; hour: number; minute: number }[] = [
  { name: "Magnum 4D", zh: "萬能", days: WED_SAT_SUN, hour: 19, minute: 5 },
  { name: "Magnum Life", zh: "万能天天彩", days: WED_SAT_SUN, hour: 19, minute: 7 },
  { name: "Magnum Jackpot Gold", zh: "萬能黃金万字积宝", days: WED_SAT_SUN, hour: 19, minute: 9 },
  { name: "Da Ma Cai 1+3D", zh: "大馬彩", days: WED_SAT_SUN, hour: 19, minute: 11 },
  { name: "Da Ma Cai 3+3D", zh: "大馬彩", days: WED_SAT_SUN, hour: 19, minute: 13 },
  { name: "Singapore 4D", zh: "新加坡", days: WED_SAT_SUN, hour: 19, minute: 15 },
  { name: "Sabah 88 4D", zh: "沙巴88", days: WED_SAT_SUN, hour: 19, minute: 17 },
  { name: "Sandakan 4D", zh: "山打根", days: WED_SAT_SUN, hour: 19, minute: 19 },
  { name: "Special Cash Sweep", zh: "沙捞越", days: WED_SAT_SUN, hour: 19, minute: 21 },
  { name: "Sports Toto 4D", zh: "多多", days: MON_WED_SAT, hour: 19, minute: 23 },
  { name: "Sports Toto 5D / 6D", zh: "多多六合彩", days: MON_WED_SAT, hour: 19, minute: 25 },
  { name: "Grand Dragon 4D", zh: "豪龙", days: EVERY_DAY, hour: 19, minute: 40 },
  { name: "Nine Lotto", zh: "开彩", days: EVERY_DAY, hour: 19, minute: 42 },
  { name: "Perdana 4D", zh: "Perdana", days: EVERY_DAY, hour: 15, minute: 45 },
  { name: "Lucky HariHari 4D", zh: "天天好运", days: EVERY_DAY, hour: 15, minute: 47 },
];

/** Stable ids so a later launch can cancel exactly what it scheduled. */
function liveIds(): number[] {
  const ids: number[] = [];
  LIVE_GAMES.forEach((g, gi) => g.days.forEach((_, di) => ids.push(3000 + gi * 10 + di)));
  return ids;
}
const ALL_IDS = [...liveIds(), NOTIFICATION_1800, NOTIFICATION_1830];

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
export default function AppNotifications({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
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
              description: "18:00 and 18:30 lucky number reminders",
              importance: 5,
              visibility: 1,
              vibration: true,
              lights: true,
              lightColor: "#ffd700",
            });
          } catch { /* already exists or unsupported on this platform */ }

          await ln.cancel?.({ notifications: [...ALL_IDS.map((id) => ({ id }))] });
          const firstLucky = luckyNumber();
          const secondLucky = luckyNumber();
          await ln.schedule?.({
            notifications: [
              {
                id: NOTIFICATION_1800,
                title: "恭喜发财 幸运号码",
                body: `18:00 4D Live 开奖开始\n幸运号码：${firstLucky}`,
                largeBody: `18:00 4D Live 开奖开始\n恭喜发财 幸运号码：${firstLucky}`,
                channelId: CHANNEL_ID,
                autoCancel: true,
                schedule: { on: { hour: 18, minute: 0 }, repeats: true, allowWhileIdle: true },
              },
              {
                id: NOTIFICATION_1830,
                title: "恭喜发财 幸运号码",
                body: `18:30 4D Live 开奖进行中\n幸运号码：${secondLucky}`,
                largeBody: `18:30 4D Live 开奖进行中\n恭喜发财 幸运号码：${secondLucky}`,
                channelId: CHANNEL_ID,
                autoCancel: true,
                schedule: { on: { hour: 18, minute: 30 }, repeats: true, allowWhileIdle: true },
              },
              ...LIVE_GAME_SCHEDULE(),
            ],
          });
        } catch {
          // Notification failure must never affect the results app.
        }
        return;
      }
    };

    void install();
    return () => { cancelled = true; };
  }, [enabled]);

  return null;
}
