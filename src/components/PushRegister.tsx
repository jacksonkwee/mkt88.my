"use client";

import { useEffect, useState } from "react";
import { isCapacitorApp } from "../lib/is-capacitor-app";
import { useLang } from "../lib/i18n";
import { RESULT_ALERT_KEY } from "./ResultAlerts";

/**
 * Gives the server this phone's address so it can push to a closed app.
 *
 * Capacitor's PushNotifications plugin hands out an FCM token; it is sent to
 * /api/push/register together with the language chosen in Settings, so the
 * "result is out" push arrives in the right language. The token is re-sent
 * whenever it changes or the language does.
 *
 * This only talks to the plugin, which is only present in the installed app;
 * on the website it does nothing, and until Firebase is connected the endpoint
 * answers 503 and this quietly gives up.
 */

type PushPlugin = {
  checkPermissions?: () => Promise<{ receive?: string }>;
  requestPermissions?: () => Promise<{ receive?: string }>;
  register?: () => Promise<void>;
  addListener?: (
    eventName: string,
    cb: (data: {
      value?: string;
      data?: Record<string, unknown>;
      notification?: { data?: Record<string, unknown> };
    }) => void
  ) => { remove?: () => void } | undefined;
};

type CapacitorGlobal = {
  Plugins?: { PushNotifications?: PushPlugin };
  registerPlugin?: (name: string, impl?: Record<string, unknown>) => PushPlugin;
};

/** Capacitor 6 fills Plugins lazily, exactly like the local-notifications one. */
function pushPlugin(): PushPlugin | null {
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap) return null;
  const ready = cap.Plugins?.PushNotifications;
  if (ready) return ready;
  try {
    const created = cap.registerPlugin?.("PushNotifications");
    if (!created) return null;
    if (!cap.Plugins) cap.Plugins = {};
    cap.Plugins.PushNotifications = created;
    return created;
  } catch {
    return null;
  }
}

export default function PushRegister({ enabled }: { enabled?: boolean }) {
  const on = enabled ?? isCapacitorApp();
  const [lang] = useLang();
  const [token, setToken] = useState("");
  const [alertsOn, setAlertsOn] = useState(true);

  /** The same switch the in-app reminder uses (Settings → 成绩出炉提醒). */
  useEffect(() => {
    const read = () => {
      try { setAlertsOn(window.localStorage.getItem(RESULT_ALERT_KEY) !== "0"); } catch { setAlertsOn(true); }
    };
    read();
    const onChange = () => read();
    window.addEventListener("mkt-result-alerts", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("mkt-result-alerts", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    let detach: (() => void) | null = null;

    const start = async () => {
      for (let attempt = 0; attempt < 20 && !cancelled; attempt++) {
        const plugin = pushPlugin();
        if (!plugin) {
          await new Promise((r) => setTimeout(r, 750));
          continue;
        }
        try {
          const before = await plugin.checkPermissions?.();
          if (before?.receive !== "granted") await plugin.requestPermissions?.();
          const after = await plugin.checkPermissions?.();
          if (after?.receive !== "granted") return;
          const registration = plugin.addListener?.("registration", (data) => {
            const value = String(data?.value || "").trim();
            if (value) {
              setToken(value);
              // Kept for /admin inside the app, which is where the owner turns
              // their own admin alerts on (see owner-alerts.ts).
              try { window.localStorage.setItem("mkt_push_token", value); } catch { /* private mode */ }
            }
          });
          const action = plugin.addListener?.("pushNotificationActionPerformed", (event) => {
            const data = event?.notification?.data || event?.data || {};
            const url = String(data.url || "").trim();
            if (!/^\/(?!\/)/.test(url)) return;
            document.body.classList.remove("mkt-home-open", "mkt-boot-wait");
            window.location.assign(url);
          });
          detach = () => {
            try { registration?.remove?.(); } catch { /* nothing to clean up */ }
            try { action?.remove?.(); } catch { /* nothing to clean up */ }
          };
          await plugin.register?.();
        } catch {
          // A phone that refuses push still gets everything else the app does.
        }
        return;
      }
    };

    void start();
    return () => { cancelled = true; detach?.(); };
  }, [on]);

  // Register (and re-register when the language or the switch changes, so the
  // server always knows where to push and in which language).
  useEffect(() => {
    if (!on || !token) return;
    void fetch("/api/push/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, lang, alerts: alertsOn }),
    }).catch(() => { /* the next app open tries again */ });
  }, [on, token, lang, alertsOn]);

  return null;
}
