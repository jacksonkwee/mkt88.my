"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Footer() {
  const [copyright, setCopyright] = useState("Copyright © 2016 - 2026 mkt88.my. All Rights Reserved.");
  useEffect(() => {
    fetch("/api/site-content")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && j.copyright) setCopyright(j.copyright);
      })
      .catch(() => {});
  }, []);
  return (
    <footer className="footer mt-auto bg-dark text-white">
      <div className="container">
        <div className="row flex-column py-2">
          {/* The official Google Play badge. The artwork has 41px of clear
              padding built into the file, so the -10px margin trims it back
              and the badge itself shows at about 40px tall. */}
          <div className="text-center" style={{ paddingTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <a
              href="https://play.google.com/store/apps/details?id=com.mkt88.app"
              target="_blank"
              rel="noreferrer"
              aria-label="Get the MKT 88 4D app on Google Play"
              /* 40px tall as it stood; the badge artwork already carries clear
                 space, so only the link box needs to grow (14 Oct 2026). */
              style={{ display: "inline-flex", alignItems: "center", minHeight: 44 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img loading="lazy"
                src="/sites/mkt88/app/google-play-badge.png"
                alt="Get it on Google Play"
                style={{ height: 60, width: "auto", margin: "-10px 0", display: "inline-block", verticalAlign: "middle" }}
              />
            </a>
            <a
              href="https://www.facebook.com/mkt88my"
              target="_blank"
              rel="noreferrer"
              aria-label="Follow MKT 88 4D on Facebook"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 44, minHeight: 44 }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#1877F2"
                  d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                />
              </svg>
            </a>
          </div>
          <div className="footer-menu text-center">
            <Link href="/about">About</Link> | <Link href="/contact">Contact</Link> | 
            <Link href="/terms">Terms of Use</Link> | 
            <Link href="/disclaimer">Disclaimer</Link> | 
            <Link href="/privacy-policy">Privacy Policy</Link>
          </div>
          <div className="text-center">{copyright}</div>
        </div>
      </div>
    </footer>
  );
}
