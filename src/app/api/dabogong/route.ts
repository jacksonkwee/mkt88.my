import { NextRequest, NextResponse } from "next/server";
import dict from "../../../components/dabogong-dict.json";
import bm from "../../../components/dabogong-bm.json";

/**
 * 大伯公 千字图 / 万字图 look-up.
 *  - ?num=0511  -> the entry for that number (picture + keyword + meaning)
 *  - ?q=狗 | okra | bendi -> every entry whose Chinese keyword, English meaning or
 *    Bahasa Malaysia term contains the text.
 */
export const dynamic = "force-dynamic";

type Entry = [string, string, string?];
const DB = dict as unknown as { e: Record<string, Entry> };
const BM = bm as unknown as Record<string, string>;

function imageFor(num: string): string {
  return num.length === 4
    ? `https://repo2.4dmanager.net/wzt/${num}.jpg`
    : `https://repo2.4dmanager.net/qzt/tpk/${num}.png`;
}
function kindFor(num: string): string {
  return num.length === 4 ? "万字图" : "大伯公千字图";
}
function row(num: string, e: Entry) {
  return { num, kind: kindFor(num), keyword: e[0] || "", meaning: e[1] || "", malay: e[2] || "", image: imageFor(num) };
}

const hasCJK = (s: string) => /[\u3400-\u9fff]/.test(s);

export async function GET(req: NextRequest) {
  const num = (req.nextUrl.searchParams.get("num") || "").trim();
  const q = (req.nextUrl.searchParams.get("q") || "").trim();

  // 1) exact number
  if (num) {
    if (!/^\d{3,4}$/.test(num)) return NextResponse.json({ error: "Enter a 3 or 4 digit number" }, { status: 400 });
    const e = DB.e[num];
    return NextResponse.json({ ...(e ? row(num, e) : { num, kind: kindFor(num), keyword: "", meaning: "", malay: "", image: imageFor(num) }), found: Boolean(e) });
  }

  if (!q) return NextResponse.json({ error: "Type a number or a word" }, { status: 400 });

  // 2) keyword search (Chinese / English / Bahasa Malaysia)
  const lower = q.toLowerCase();
  const cjk = hasCJK(q);
  const terms = [lower];
  // Bahasa Malaysia -> English, via the built-in supplements / reverse word list
  const bmHit = BM[lower] || Object.keys(BM).find((k) => lower.startsWith(k + " ") || lower === k);
  if (bmHit) terms.push(String(bmHit).toLowerCase());

  const matches: ReturnType<typeof row>[] = [];
  const loose: ReturnType<typeof row>[] = [];
  const wordsOf = (s: string) => s.split(/[^a-z0-9]+/).filter(Boolean);
  for (const [n, e] of Object.entries(DB.e)) {
    const zh = (e[0] || "").toLowerCase();
    const en = (e[1] || "").toLowerCase();
    const ms = (e[2] || "").toLowerCase();
    if (cjk) {
      if (zh.includes(lower)) { matches.push(row(n, e)); if (matches.length >= 80) break; }
      continue;
    }
    const enWords = wordsOf(en);
    const msWords = wordsOf(ms);
    let hit = false;
    for (const t of terms) {
      if (enWords.includes(t) || msWords.includes(t)) { hit = true; break; }
      if (t.includes(" ") && (en.includes(t) || ms.includes(t))) { hit = true; break; }
    }
    if (hit) { matches.push(row(n, e)); if (matches.length >= 80) break; continue; }
    // keep looser matches (partial words) only to fill the list when needed
    if (loose.length < 80 && terms.some((t) => en.includes(t) || ms.includes(t) || zh.includes(t))) loose.push(row(n, e));
  }
  if (matches.length === 0) matches.push(...loose.slice(0, 40));

  matches.sort((a, b) => Number(a.num) - Number(b.num));
  return NextResponse.json({ q, total: matches.length, matches }, { headers: { "cache-control": "no-store" } });
}


