"use client";

import { useEffect, useState } from "react";

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
            <a href="/disclaimer">Disclaimer</a> | <a href="/privacy-policy">Privacy Policy</a>
          </div>
          <div className="text-center">{copyright}</div>
        </div>
      </div>
    </footer>
  );
}
