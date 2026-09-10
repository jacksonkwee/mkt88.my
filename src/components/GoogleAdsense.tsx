"use client";

import { useEffect } from "react";
import { ADS_CLIENT } from "./sites/live4dresult-net-0600c55d/root-8a5edab2/ad-config";
import { isCapacitorApp } from "../lib/is-capacitor-app";

export default function GoogleAdsense() {
  useEffect(() => {
    // AdSense is for the website. The Android app uses AdMob instead.
    if (isCapacitorApp()) return;
    if (!ADS_CLIENT) return;
    if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
      const s = document.createElement("script");
      s.async = true;
      s.crossOrigin = "anonymous";
      s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + ADS_CLIENT;
      document.head.appendChild(s);
    }
  }, []);
  return null;
}