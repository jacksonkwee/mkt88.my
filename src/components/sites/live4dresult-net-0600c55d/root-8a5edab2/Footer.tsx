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
          <div className="text-center" style={{ paddingTop: 8 }}>
            <a
              href="https://play.google.com/store/apps/details?id=com.mkt88.app"
              target="_blank"
              rel="noreferrer"
              aria-label="Get the MKT 88 4D app on Google Play"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sites/live4dresult-net-0600c55d/root-8a5edab2/google-play-badge.png"
                alt="Get it on Google Play"
                style={{ height: 60, width: "auto", margin: "-10px 0", display: "inline-block", verticalAlign: "middle" }}
              />
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
