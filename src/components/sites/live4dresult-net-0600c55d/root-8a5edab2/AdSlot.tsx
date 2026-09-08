"use client";

import { useEffect, useRef } from "react";
import { ADS_CLIENT, ADS_ENABLED, ADS_SLOTS } from "./ad-config";

interface Props {
  slot: keyof typeof ADS_SLOTS;
  className?: string;
}

export default function AdSlot({ slot, className }: Props) {
  const insRef = useRef<HTMLModElement>(null);
  useEffect(() => {
    if (!ADS_ENABLED) return;
    const client = ADS_CLIENT;
    if (!client) return;
    if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
      const s = document.createElement("script");
      s.async = true;
      s.crossOrigin = "anonymous";
      s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + client;
      document.head.appendChild(s);
    }
    // small delay so AdSense can pick up the ins element
    const t = setTimeout(() => {
      try {
        const w = window as unknown as { adsbygoogle?: unknown[] };
        w.adsbygoogle = w.adsbygoogle || [];
        w.adsbygoogle.push({});
      } catch {
        /* noop */
      }
    }, 200);
    return () => clearTimeout(t);
  }, []);

  if (!ADS_ENABLED) return null;
  const adSlotId = ADS_SLOTS[slot];
  if (!adSlotId) return null;
  return (
    <div className={"text-center my-2 " + (className || "")}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADS_CLIENT}
        data-ad-slot={adSlotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
