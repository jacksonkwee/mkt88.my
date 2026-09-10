"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const RED = "#cc0000";

type Resp = { num: string; kind: string; keyword: string; meaning: string; image: string; found: boolean };

export default function DaBoGongApp() {
  const params = useSearchParams();
  const initial = (params.get("num") || "").replace(/\D/g, "").slice(0, 4);

  const [num, setNum] = useState(/^\d{3,4}$/.test(initial) ? initial : "");
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [failedImg, setFailedImg] = useState(false);
  const mounted = useRef(true);
  const reqId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const look = useCallback((n: string) => {
    if (!/^\d{3,4}$/.test(n)) { setData(null); return; }
    const id = ++reqId.current;
    setLoading(true);
    setErr("");
    setFailedImg(false);
    fetch("/api/dabogong?num=" + n, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!mounted.current || id !== reqId.current) return;
        if (!j || j.error) { setData(null); setErr("Invalid number."); }
        else setData(j);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted.current || id !== reqId.current) return;
        setErr("Unable to load. Please try again.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!num) { setData(null); return; }
    const t = window.setTimeout(() => look(num), 300);
    return () => window.clearTimeout(t);
  }, [num, look]);

  const src = data ? (failedImg ? "/api/dabogong/img?u=" + encodeURIComponent(data.image) : data.image) : "";

  return (
    <div style={{ minHeight: "100vh", background: "#f4f4f4", fontFamily: "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif", paddingBottom: 60 }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: RED, color: "#fff", display: "flex", alignItems: "center", gap: 6, padding: "10px 8px", boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}>
        <button onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = "/"))}
          style={{ background: "transparent", border: 0, color: "#fff", fontSize: 24, lineHeight: 1, cursor: "pointer", padding: "2px 8px" }} aria-label="Back">←</button>
        <div style={{ flex: 1, textAlign: "center", fontWeight: 800, fontSize: 18 }}>大伯公 千字图万字图</div>
        <a href="/" style={{ color: "#fff", fontSize: 13, textDecoration: "none", padding: "6px 8px" }}>Home</a>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: 12 }}>
        {/* Only a search bar */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
          <input
            value={num}
            onChange={(e) => setNum(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => e.key === "Enter" && look(num)}
            placeholder="输入 3 或 4 位数"
            inputMode="numeric"
            autoFocus
            style={{ width: "100%", padding: "14px 12px", border: "2px solid " + RED, borderRadius: 10, fontSize: 26, letterSpacing: 8, textAlign: "center", fontWeight: 800 }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => look(num)} style={{ flex: 1, background: RED, color: "#fff", border: 0, borderRadius: 10, padding: "12px 0", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
              Search 查询
            </button>
            <button onClick={() => { setNum(""); setData(null); }} style={{ flex: 1, background: "#fff", color: "#333", border: "1px solid #ccc", borderRadius: 10, padding: "12px 0", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              Clear 清除
            </button>
          </div>
        </div>

        {loading ? <div style={{ textAlign: "center", color: "#777", padding: 24 }}>Loading…</div> : null}
        {err && !loading ? <div style={{ textAlign: "center", color: RED, padding: 20 }}>{err}</div> : null}

        {data && !loading ? (
          <div style={{ background: "#fff", borderRadius: 12, marginTop: 12, padding: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: 6, color: RED }}>{data.num}</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>{data.kind}</div>
            <img
              src={src}
              alt={data.keyword || data.num}
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={() => setFailedImg(true)}
              style={{ width: "100%", maxWidth: 280, borderRadius: 12, border: "1px solid #eee", background: "#fff" }}
            />
            {data.keyword ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{data.keyword}</div>
                {data.meaning ? <div style={{ fontSize: 14, color: "#666", marginTop: 2 }}>{data.meaning}</div> : null}
              </div>
            ) : (
              <div style={{ marginTop: 10, fontSize: 13, color: "#888" }}>Picture for {data.num}.</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
