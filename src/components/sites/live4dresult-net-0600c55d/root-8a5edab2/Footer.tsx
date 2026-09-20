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
          <div className="footer-menu text-center">
            <Link href="/disclaimer">Disclaimer</Link> | <Link href="/privacy-policy">Privacy Policy</Link>
          </div>
          <div className="text-center">{copyright}</div>
        </div>
      </div>
    </footer>
  );
}
