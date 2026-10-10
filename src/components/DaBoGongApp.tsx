"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react";
import { useLang, tr } from "../lib/i18n";
import AppTopBar from "./AppTopBar";

const RED = "#cc0000";

type Entry = { num: string; kind: string; keyword: string; meaning: string; malay?: string; image: string; found?: boolean };
type Resp = Entry & { q?: string; matches?: Entry[] };

/** 0 = direct CDN, 1 = our proxy, 2 = give up and draw a placeholder. */
type ImgStage = 0 | 1 | 2;

const isNumber = (v: string) => /^\d{3,4}$/.test(v);
const historyHref = (num: string) => (num.length === 4 ? "/number-history?num=" + num : null);

export default function DaBoGongApp() {
  const params = useSearchParams();
  const [lang] = useLang();
  const initial = (params.get("num") || "").trim();

  /** The API returns the chart kind in Chinese; show it in the reader's language. */
  const kindLabel = (k: string) =>
    k === "万字图" ? tr("dbgKind10k", lang) : k === "大伯公千字图" ? tr("dbgKind1k", lang) : k;

  const [text, setText] = useState(initial);
  const [data, setData] = useState<Resp | null>(null);
  const [results, setResults] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [errKey, setErrKey] = useState("");
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
    setErrKey("");
    const url = isNumber(q) ? "/api/dabogong?num=" + q : "/api/dabogong?q=" + encodeURIComponent(q);
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!mounted.current || id !== reqId.current) return;
        if (!j || j.error) { setData(null); setResults(null); setErrKey("dbgNothing"); }
        else if (j.matches) { setResults(j.matches); setData(null); }
        else { setData(j); setResults(null); }
        setLoading(false);
      })
      .catch(() => {
        if (!mounted.current || id !== reqId.current) return;
        setErrKey("dbgLoadFail");
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
        <div style={{ width: size, height: size, borderRadius: 12, border: "1px solid #eee", background: "#fff7e6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ fontSize: size > 60 ? 18 : 13, fontWeight: 800, color: "#cc0000", letterSpacing: 1 }}>{e.num}</div>
          <div style={{ fontSize: 11, color: "#888" }}>{tr("dbgImage", lang)}</div>
        </div>
      );
    }
    return (
      <img src={src} alt={e.keyword || e.num} referrerPolicy="no-referrer" loading="lazy"
        onError={() => nextStage(e.num)}
        onLoad={() => setStage((m) => (m[e.num] === 2 ? { ...m, [e.num]: 0 } : m))}
        style={{ width: size, height: size, objectFit: "cover", borderRadius: 12, border: "1px solid #eee", background: "#fff", flexShrink: 0 }} />
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f4f4f4", fontFamily: "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif", paddingBottom: 60 }}>
      <AppTopBar titleKey="dabogongTitle" />
      <div style={{ maxWidth: 480, margin: "0 auto", padding: 12 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 24))}
            onKeyDown={(e) => e.key === "Enter" && look(text)}
            placeholder={tr("dbgPlaceholder", lang)}
            autoFocus
            style={{ width: "100%", padding: "14px 12px", border: "2px solid " + RED, borderRadius: 12, fontSize: 24, textAlign: "center", fontWeight: 800 }}
          />
          <div style={{ fontSize: 11, color: "#888", textAlign: "center", marginTop: 6 }}>
            {tr("dbgHint", lang)}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => look(text)} style={{ flex: 1, background: RED, color: "#fff", border: 0, borderRadius: 12, padding: "12px 0", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>{tr("dbgSearch", lang)}</button>
            <button onClick={() => { setText(""); setData(null); setResults(null); }} style={{ flex: 1, background: "#fff", color: "#333", border: "1px solid #ccc", borderRadius: 12, padding: "12px 0", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{tr("dbgClear", lang)}</button>
          </div>
        </div>

        {loading ? <div style={{ textAlign: "center", color: "#777", padding: 24 }}>{tr("loading", lang)}</div> : null}
        {errKey && !loading ? <div style={{ textAlign: "center", color: RED, padding: 20 }}>{tr(errKey, lang)}</div> : null}

        {/* Single number result */}
        {data && !loading ? (
          <div style={{ background: "#fff", borderRadius: 12, marginTop: 12, padding: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 6, color: RED }}>{data.num}</div>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>{kindLabel(data.kind)}</div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Picture e={data} size={260} />
            </div>
            {data.keyword ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{data.keyword}</div>
                {data.meaning ? <div style={{ fontSize: 15, color: "#666", marginTop: 2 }}>{data.meaning}</div> : null}
                {data.malay ? <div style={{ fontSize: 13, color: "#666" }}>{data.malay}</div> : null}
              </div>
            ) : null}
            {historyHref(data.num) ? (
              <Link href={historyHref(data.num)!} style={{ display: "inline-block", marginTop: 12, background: RED, color: "#fff", borderRadius: 12, padding: "10px 18px", fontWeight: 800, textDecoration: "none" }}>
                {tr("history", lang)} <ArrowRight size={11} weight="bold" style={{ verticalAlign: "-1px" }} />
              </Link>
            ) : null}
          </div>
        ) : null}

        {/* Keyword results */}
        {results && !loading ? (
          <div style={{ background: "#fff", borderRadius: 12, marginTop: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #eee", fontSize: 13, color: "#777" }}>
              {results.length} {results.length === 1 ? tr("dbgResultOne", lang) : tr("dbgResultMany", lang)} “{text.trim()}” · {tr("dbgTapHistory", lang)}
            </div>
            {results.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "#888" }}>{tr("dbgNoMatch", lang)}</div>
            ) : results.map((r) => {
              const href = historyHref(r.num);
              const inner = (
                <>
                  <Picture e={r} size={54} />
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{r.keyword}</div>
                    <div style={{ fontSize: 13, color: "#666" }}>{r.meaning}{r.malay ? " · " + r.malay : ""}</div>
                    {href ? <div style={{ fontSize: 11, color: RED, fontWeight: 700, marginTop: 2 }}>{tr("history", lang)} <ArrowRight size={11} weight="bold" style={{ verticalAlign: "-1px" }} /></div> : null}
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 18, color: RED, letterSpacing: 2 }}>{r.num}</div>
                </>
              );
              return href ? (
                <Link key={r.num} href={href}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", borderBottom: "1px solid #f0f0f0", background: "#fff", textDecoration: "none", color: "inherit" }}>
                  {inner}
                </Link>
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
