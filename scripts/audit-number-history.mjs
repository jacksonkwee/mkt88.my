import fs from "node:fs";
const API = "http://127.0.0.1:3999/api/number-history";
const DEEP = JSON.parse(fs.readFileSync("src/lib/deep-past.json", "utf8"));
const CATS = { "1st": 0, "2nd": 1, "3rd": 2, Special: 3, Consolation: 4 };
const CAT_RE = /^\s*(1st|2nd|3rd)(?:\s*Prize)?\b|^\s*(Special|Consolation)/i;
const clean = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
const norm = (s) => (s || "").replace(/\s+/g, "").toLowerCase();
const isoOf = (dmy) => { const [d, m, y] = dmy.split("-"); return y + "-" + m + "-" + d; };

function fromPage(html, iso) {
  const out = [];
  const starts = []; const re = /class="card outer-box (table-[0-9][^"]*)"/g; let m;
  while ((m = re.exec(html))) starts.push(m.index);
  for (let k = 0; k < starts.length; k++) {
    const seg = html.slice(starts[k], k + 1 < starts.length ? starts[k + 1] : html.length);
    const name = clean((seg.match(/lottery-name[^>]*>([\s\S]*?)<\/div>/) || [])[1]);
    if (!name) continue;
    let cat = null;
    for (const c of seg.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)) {
      const txt = clean(c[1]);
      const lm = CAT_RE.exec(txt);
      if (lm) { const k2 = (lm[1] || lm[2] || "").toLowerCase(); cat = k2 === "1st" || k2 === "2nd" || k2 === "3rd" ? k2 : k2.startsWith("special") ? "Special" : k2.startsWith("consolation") ? "Consolation" : null; continue; }
      const v = txt.replace(/\s+/g, "");
      if (/^\d{4}$/.test(v) && cat) out.push({ game: name, prize: cat, num: v, iso });
    }
  }
  return out;
}

function fromDeep(iso) {
  const day = DEEP[iso]; if (!day) return [];
  const out = [];
  for (const g of Object.values(day)) {
    for (const [label, value] of g.p || []) {
      const m = CAT_RE.exec(label);
      if (m && /^\d{4}$/.test(value)) out.push({ game: g.n, prize: (m[1] || m[2]) === "Special" ? "Special" : (m[1] || m[2]) === "Consolation" ? "Consolation" : m[1].toLowerCase(), num: value, iso });
    }
    for (const [label, list] of g.g || []) {
      const m = CAT_RE.exec(label); if (!m) continue;
      const which = (m[1] || m[2] || "");
      const prize = /^special/i.test(which) ? "Special" : "Consolation";
      for (const v of list || []) if (/^\d{4}$/.test(v)) out.push({ game: g.n, prize, num: v, iso });
    }
  }
  return out;
}

async function expectFor(iso) {
  if (DEEP[iso]) return { src: "deep archive", rows: fromDeep(iso) };
  const r = await fetch("https://live4dresult.net/past-results/" + iso, { headers: { "user-agent": "Mozilla/5.0" } });
  const html = r.ok ? await r.text() : "";
  const rows = /card outer-box table-/.test(html) ? fromPage(html, iso) : [];
  return { src: "live archive", rows };
}

const dates = ["2021-09-22","2021-12-01","2022-02-09","2022-04-20","2022-04-21","2022-05-11","2022-06-15","2022-07-13","2022-07-27","2022-10-05","2023-06-14","2024-03-20","2025-08-13","2026-01-07","2026-06-10","2026-09-12","2026-09-16","2026-09-19"];

let totalExp = 0, totalMiss = 0;
const gamesSeen = new Map();
for (const iso of dates) {
  const { src, rows } = await expectFor(iso);
  if (!rows.length) { console.log(iso + "   no source rows (" + src + ")"); continue; }
  const dmy = iso.slice(8,10) + "-" + iso.slice(5,7) + "-" + iso.slice(0,4);
  const nums = [...new Set(rows.map(r => r.num))];
  const found = new Set();
  for (let i = 0; i < nums.length; i += 55) {
    const batch = nums.slice(i, i + 55);
    const j = await (await fetch(API + "?num=" + batch.join(",") + "&cb=" + Date.now())).json();
    for (const m of j.matches) if (m.date.startsWith(dmy)) found.add(m.num + "|" + norm(m.game) + "|" + m.prize);
  }
  let miss = 0; const examples = [];
  for (const r of rows) {
    const key = r.num + "|" + norm(r.game) + "|" + r.prize;
    if (found.has(key)) continue;
    const loose = [...found].some(f => { const [n, g, p] = f.split("|"); return n === r.num && p === r.prize && (g.includes(norm(r.game)) || norm(r.game).includes(g)); });
    if (!loose) { miss++; if (examples.length < 3) examples.push(r.game + " " + r.prize + " " + r.num); }
    else found.add(key);
  }
  for (const r of rows) gamesSeen.set(r.game, (gamesSeen.get(r.game) || 0) + 1);
  totalExp += rows.length; totalMiss += miss;
  console.log(iso + "  " + String(rows.length).padStart(4) + " records   missing " + miss + (miss ? "   e.g. " + examples.join(" ; ") : "") + "   (" + src + ")");
}
console.log("\nTOTAL: " + totalExp + " records checked across " + dates.length + " draw dates, " + totalMiss + " missing");
console.log("companies covered: " + gamesSeen.size);
for (const [g, n] of [...gamesSeen.entries()].sort((a,b)=>b[1]-a[1])) console.log("   " + String(n).padStart(5) + "  " + g);
