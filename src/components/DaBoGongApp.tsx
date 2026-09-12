"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const RED = "#cc0000";

type Entry = { num: string; kind: string; keyword: string; meaning: string; malay?: string; image: string; found?: boolean };
type Resp = Entry & { q?: string; matches?: Entry[] };

/** 0 = direct CDN, 1 = our proxy, 2 = give up and draw a placeholder. */
type ImgStage = 0 | 1 | 2;

const isNumber = (v: string) => /^\d{3,4}$/.test(v);
const historyHref = (num: string) => (num.length === 4 ? "/number-history?num=" + num : null);

export default function DaBoGongApp() {
  const params = useSearchParams();
  const initial = (params.get("num") || "").trim();

  const [text, setText] = useState(initial);
  const [data, setData] = useState<Resp | null>(null);
  const [results, setResults] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [stage, setStage] = useState<Record<string, ImgStage>>({});
  const mounted = useRef(true);
  const reqId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const look = useCallback((raw: string) => {
    const q = raw.trim();
    if (!q) { setData(null); setResults(null); return; }
    const id = ++reqId.current;
    setLoading(true);
    setErr("");
    const url = isNumber(q) ? "/api/dabogong?num=" + q : "/api/dabogong?q=" + encodeURIComponent(q);
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!mounted.current || id !== reqId.current) return;
        if (!j || j.error) { setData(null); setResults(null); setErr("Nothing found."); }
        else if (j.matches) { setResults(j.matches); setData(null); }
        else { setData(j); setResults(null); }
        setLoading(false);
      })
      .catch(() => {
        if (!mounted.current || id !== reqId.current) return;
        setErr("Unable to load. Please try again.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!text.trim()) { setData(null); setResults(null); return; }
    const t = window.setTimeout(() => look(text), 350);
    return () => window.clearTimeout(t);
  }, [text, look]);

  /** The URL to try for this number at the current stage. */
  const srcFor = (e: Entry) => {
    const s = stage[e.num] ?? 0;
    if (s === 1) return "/api/dabogong/img?u=" + encodeURIComponent(e.image) + "&r=1";
    if (s === 2) return "";
    return e.image;
  };
  const nextStage = (num: string) =>
    setStage((m) => ({ ...m, [num]: ((m[num] ?? 0) + 1) as ImgStage }));

  const Picture = ({ e, size }: { e: Entry; size: number }) => {
    const src = srcFor(e);
    if (!src) {
      return (
        <div style={{ width: size, height: size, borderRadius: 8, border: "1px solid #eee", background: "#fff7e6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ fontSize: size > 60 ? 18 : 13, fontWeight: 800, color: "#cc0000", letterSpacing: 1 }}>{e.num}</div>
          <div style={{ fontSize: 9, color: "#888" }}>图片</div>
        </div>
      );
    }
    return (
      <img src={src} alt={e.keyword || e.num} referrerPolicy="no-referrer" loading="lazy"
        onError={() => nextStage(e.num)}
        onLoad={() => setStage((m) => (m[e.num] === 2 ? { ...m, [e.num]: 0 } : m))}
        style={{ width: size, height: size, objectFit: "cover", borderRadius: 8, border: "1px solid #eee", background: "#fff", flexShrink: 0 }} />
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f4f4f4", fontFamily: "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif", paddingBottom: 60 }}>
      <div className="mkt-app-topbar" style={{ position: "sticky", top: 0, zIndex: 50, background: RED, color: "#fff", display: "flex", alignItems: "center", gap: 6, padding: "10px 8px", boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}>
        <button onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = "/"))}
          style={{ background: "transparent", border: 0, color: "#fff", fontSize: 24, lineHeight: 1, cursor: "pointer", padding: "2px 8px" }} aria-label="Back">←</button>
        <div style={{ flex: 1, textAlign: "center", fontWeight: 800, fontSize: 18 }}>大伯公 千字图万字图</div>
        <a href="/" style={{ color: "#fff", fontSize: 13, textDecoration: "none", padding: "6px 8px" }}>Home</a>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: 12 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 24))}
            onKeyDown={(e) => e.key === "Enter" && look(text)}
            placeholder="号码或词语 / number or word"
            autoFocus
            style={{ width: "100%", padding: "14px 12px", border: "2px solid " + RED, borderRadius: 10, fontSize: 22, textAlign: "center", fontWeight: 800 }}
          />
          <div style={{ fontSize: 11.5, color: "#888", textAlign: "center", marginTop: 6 }}>
            输入 3-4 位数或词语 · 中文 / English / BM · 例 666 · okra · bendi · 狗 · dog · anjing
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => look(text)} style={{ flex: 1, background: RED, color: "#fff", border: 0, borderRadius: 10, padding: "12px 0", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Search 查询</button>
            <button onClick={() => { setText(""); setData(null); setResults(null); }} style={{ flex: 1, background: "#fff", color: "#333", border: "1px solid #ccc", borderRadius: 10, padding: "12px 0", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Clear 清除</button>
          </div>
        </div>

        {loading ? <div style={{ textAlign: "center", color: "#777", padding: 24 }}>Loading…</div> : null}
        {err && !loading ? <div style={{ textAlign: "center", color: RED, padding: 20 }}>{err}</div> : null}

        {/* Single number result */}
        {data && !loading ? (
          <div style={{ background: "#fff", borderRadius: 12, marginTop: 12, padding: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: 6, color: RED }}>{data.num}</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>{data.kind}</div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Picture e={data} size={260} />
            </div>
            {data.keyword ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{data.keyword}</div>
                {data.meaning ? <div style={{ fontSize: 14, color: "#666", marginTop: 2 }}>{data.meaning}</div> : null}
                {data.malay ? <div style={{ fontSize: 13, color: "#666" }}>{data.malay}</div> : null}
              </div>
            ) : null}
            {historyHref(data.num) ? (
              <a href={historyHref(data.num)!} style={{ display: "inline-block", marginTop: 12, background: RED, color: "#fff", borderRadius: 10, padding: "10px 18px", fontWeight: 800, textDecoration: "none" }}>
                开彩记录 Number History →
              </a>
            ) : null}
          </div>
        ) : null}

        {/* Keyword results */}
        {results && !loading ? (
          <div style={{ background: "#fff", borderRadius: 12, marginTop: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #eee", fontSize: 13, color: "#777" }}>
              {results.length} result{results.length === 1 ? "" : "s"} for “{text.trim()}” · tap a number for its 开彩记录
            </div>
            {results.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "#888" }}>No number found for that word.</div>
            ) : results.map((r) => {
              const href = historyHref(r.num);
              const inner = (
                <>
                  <Picture e={r} size={54} />
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{r.keyword}</div>
                    <div style={{ fontSize: 12.5, color: "#666" }}>{r.meaning}{r.malay ? " · " + r.malay : ""}</div>
                    {href ? <div style={{ fontSize: 11.5, color: RED, fontWeight: 700, marginTop: 2 }}>开彩记录 Number History →</div> : null}
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 18, color: RED, letterSpacing: 2 }}>{r.num}</div>
                </>
              );
              return href ? (
                <a key={r.num} href={href}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", borderBottom: "1px solid #f0f0f0", background: "#fff", textDecoration: "none", color: "inherit" }}>
                  {inner}
                </a>
              ) : (
                <button key={r.num} onClick={() => setText(r.num)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #f0f0f0", background: "#fff", border: 0, cursor: "pointer" }}>
                  {inner}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
