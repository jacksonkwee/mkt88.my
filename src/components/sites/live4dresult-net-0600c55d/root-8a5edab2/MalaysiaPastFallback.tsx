"use client";

import { useEffect, useState } from "react";

export default function MalaysiaPastFallback({ date }: { date: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    fetch("/api/my-past?date=" + date)
      .then(async (r) => {
        if (!r.ok) throw new Error("load failed");
        const j = await r.json();
        if (alive) setHtml(j.html || "");
      })
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, [date]);
  if (err) return <div className="alert alert-warning mt-3 text-center">Could not load results: {err}</div>;
  if (html === null) return <div className="alert alert-info mt-3 text-center">Loading results…</div>;
  if (html === "") return <div className="alert alert-warning mt-3 text-center">No Malaysia &amp; Singapore results yet for this date.</div>;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
