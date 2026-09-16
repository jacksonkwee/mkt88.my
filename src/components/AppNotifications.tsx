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

          await ln.cancel?.({ notifications: [{ id: NOTIFICATION_1800 }, { id: NOTIFICATION_1830 }] });
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
                schedule: { on: { hour: 18, minute: 0 }, allowWhileIdle: true },
              },
              {
                id: NOTIFICATION_1830,
                title: "恭喜发财 幸运号码",
                body: `18:30 4D Live 开奖进行中\n幸运号码：${secondLucky}`,
                largeBody: `18:30 4D Live 开奖进行中\n恭喜发财 幸运号码：${secondLucky}`,
                channelId: CHANNEL_ID,
                autoCancel: true,
                schedule: { on: { hour: 18, minute: 30 }, allowWhileIdle: true },
              },
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
