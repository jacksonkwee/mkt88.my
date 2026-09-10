import { NextRequest, NextResponse } from "next/server";

/**
 * 大伯公 千字图 / 万字图 look-up.
 * Given a 3 or 4 digit number, returns the picture + Chinese keyword + English
 * meaning (sourced from 4dmanager.net's public number pages) plus a few
 * related numbers.
 */
export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

type Entry = { num: string; kind: string; keyword: string; meaning: string; image: string };
type Resp = Entry & { related: Entry[] };

const cache = new Map<string, { at: number; data: Resp }>();
const TTL = 6 * 60 * 60 * 1000;

function kindOf(src: string, num: string): string {
  if (/\/wzt\//i.test(src)) return "万字图";
  if (/\/qzt\/tpk\//i.test(src)) return "大伯公千字图";
  if (/\/qzt\/gym\//i.test(src)) return "观音千字图";
  if (/\/qzt\//i.test(src)) return "千字图";
  return num.length === 4 ? "万字图" : "大伯公千字图";
}

function fallbackImage(num: string): string {
  return num.length === 4
    ? `https://repo2.4dmanager.net/wzt/${num}.jpg`
    : `https://repo2.4dmanager.net/qzt/tpk/${num}.png`;
}

/** Pull the number's own entry first, then its related suggestions. */
function parse(html: string, num: string): { primary: Entry | null; related: Entry[] } {
  const imgRe = /<img\b[^>]*>/gi;
  const found: { src: string; alt: string; title: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html))) {
    const tag = m[0];
    const src = (tag.match(/src="([^"]+)"/) || [])[1] || "";
    const alt = ((tag.match(/alt="([^"]*)"/) || [])[1] || "").replace(/&amp;/g, "&").trim();
    const title = ((tag.match(/title="([^"]*)"/) || [])[1] || "").replace(/&amp;/g, "&").trim();
    if (!/repo2\.4dmanager\.net\/(wzt|qzt)\//i.test(src) || !title) continue;
    found.push({ src, alt, title });
  }
  const toEntry = (f: { src: string; alt: string; title: string }): Entry => {
    let meaning = f.alt;
    if (meaning.indexOf(f.title) === 0) meaning = meaning.slice(f.title.length).trim();
    if (!meaning) meaning = f.alt.replace(f.title, "").trim();
    return { num, kind: kindOf(f.src, num), keyword: f.title, meaning, image: f.src };
  };
  if (!found.length) return { primary: null, related: [] };
  const primary = toEntry(found[0]);
  const related: Entry[] = [];
  for (const f of found.slice(1)) {
    if (related.length >= 6) break;
    if (f.src === found[0].src) continue;
    const relNum = (f.src.match(/(\d{3,4})\.(?:jpg|png|webp)$/i) || [])[1] || "";
    if (!relNum) continue;
    const e = toEntry(f);
    related.push({ ...e, num: relNum });
  }
  return { primary, related };
}

export async function GET(req: NextRequest) {
  const num = (req.nextUrl.searchParams.get("num") || "").trim();
  if (!/^\d{3,4}$/.test(num)) {
    return NextResponse.json({ error: "Enter a 3 or 4 digit number" }, { status: 400 });
  }

  const hit = cache.get(num);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.data);

  let data: Resp = { num, kind: kindOf(fallbackImage(num), num), keyword: "", meaning: "", image: fallbackImage(num), related: [] };
  try {
    const res = await fetch("https://4dmanager.net/no/" + num, {
      headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) {
      const html = await res.text();
      const { primary, related } = parse(html, num);
      if (primary) data = { ...primary, related };
    }
  } catch { /* keep fallback (picture only) */ }

  cache.set(num, { at: Date.now(), data });
  if (cache.size > 300) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  return NextResponse.json(data);
}
