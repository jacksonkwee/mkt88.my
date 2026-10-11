"use client";

import { useEffect, useState } from "react";
import { isCapacitorApp } from "../lib/is-capacitor-app";
import { useLang } from "../lib/i18n";

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
    cb: (data: { value?: string }) => void
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
          const handle = plugin.addListener?.("registration", (data) => {
            const value = String(data?.value || "").trim();
            if (value) setToken(value);
          });
          detach = () => { try { handle?.remove?.(); } catch { /* nothing to clean up */ } };
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

  // Register (and re-register when the language changes, so the push follows it).
  useEffect(() => {
    if (!on || !token) return;
    void fetch("/api/push/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, lang }),
    }).catch(() => { /* the next app open tries again */ });
  }, [on, token, lang]);

  return null;
}
