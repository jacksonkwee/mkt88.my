// Build the 大伯公 千字图 / 万字图 dictionary (number -> keyword + meaning)
// from 4dmanager.net listing pages. Run: node scripts/build-dabogong.mjs
import fs from "node:fs";

const OUT = "src/components/dabogong-dict.json";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const CJK = /[\u3400-\u9fff]/;
const HAS_LATIN = /[A-Za-z]/;

async function fetchPage(kind, page) {
  const res = await fetch(`https://4dmanager.net/qzt/${kind}/${page}`, {
    headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return "";
  return await res.text();
}

function parseEntries(html, digits) {
  const lines = html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&rsquo;/g, "'")
    .replace(/&nbsp;/g, " ")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const re = digits === 4 ? /^\d{4}$/ : /^\d{3}$/;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    const kw = lines[i + 1] || "";
    const en = lines[i + 2] || "";
    if (!CJK.test(kw) || HAS_LATIN.test(kw)) continue;      // pure Chinese keyword
    if (!HAS_LATIN.test(en) || CJK.test(en)) continue;       // English meaning
    if (kw.length > 30 || en.length > 90) continue;
    out.push([lines[i], kw, en]);
  }
  return out;
}

async function main() {
  const entries = {};
  const jobs = [];
  for (let p = 1; p <= 200; p++) jobs.push(["wzt", p, 4]);
  for (let p = 1; p <= 40; p++) jobs.push(["tpk", p, 3]);

  let done = 0;
  let idx = 0;
  const CONC = 5;
  async function worker() {
    while (idx < jobs.length) {
      const [kind, page, digits] = jobs[idx++];
      let html = "";
      try { html = await fetchPage(kind, page); } catch { html = ""; }
      if (html) for (const [n, kw, en] of parseEntries(html, digits)) {
        if (!entries[n]) entries[n] = [kw, en];
      }
      done++;
      if (done % 40 === 0) console.error(`  ${done}/${jobs.length} pages`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()));

  const db = { built: new Date().toISOString(), source: "4dmanager.net", e: entries };
  fs.writeFileSync(OUT, JSON.stringify(db));
  const kb = Math.round(fs.statSync(OUT).size / 1024);
  const four = Object.keys(entries).filter((k) => k.length === 4).length;
  const three = Object.keys(entries).filter((k) => k.length === 3).length;
  console.log(`dictionary written: ${kb} KB | 4-digit ${four}/10000 | 3-digit ${three}/1000`);
  for (const probe of ["0511", "2609", "007", "1782"]) console.log("  ", probe, JSON.stringify(entries[probe] || null));
}

main().catch((e) => { console.error(e); process.exit(1); });
