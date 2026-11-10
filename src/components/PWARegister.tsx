"use client";

import { useEffect } from "react";
import { isCapacitorApp } from "../lib/is-capacitor-app";

export default function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    /*
     * The Android WebView loads the live site directly, so it already has the
     * current HTML and assets. Registering the website's service worker there
     * made its second same-origin navigation wait indefinitely and left the
     * user on a blank page until the app was force-closed. Remove registrations
     * left by older builds as well; the normal website still uses the PWA.
     */
    if (isCapacitorApp()) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => {});
      if ("caches" in window) {
        void caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name)))).catch(() => {});
      }
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => {});
  }, []);
  return null;
}
