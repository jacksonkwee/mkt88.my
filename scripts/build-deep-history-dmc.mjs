// Merge official Da Ma Cai 1+3D past results (2005 -> now) into the
// number-history database. Run: node scripts/build-deep-history-dmc.mjs
//
// The operator publishes one JSON per draw date behind a signed link:
//   /ListPastResult                       -> every archived draw date
//   /callpassresult?pastdate=YYYYMMDD     -> signed link for that date
import fs from "node:fs";

const DB_FILE = "src/components/sites/mkt88/app/number-history-db.json";
const DAY0 = Date.UTC(2020, 0, 1);
const epochDay = (iso) => Math.round((Date.parse(iso + "T00:00:00Z") - DAY0) / 86400000);
const is4 = (v) => /^\d{4}$/.test(String(v || ""));

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const H = {
  "User-Agent": UA,
  Accept: "application/json, text/javascript, */*; q=0.01",
  "Accept-Encoding": "identity",
  "X-Requested-With": "XMLHttpRequest",
  cookiesession: "766",
  Referer: "https://www.damacai.com.my/past-draw-result/",
};

async function getText(url) {
  const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(30000) });
  if (!r.ok) return "";
  return await r.text();
}

async function listDates() {
  const t = await getText("https://www.damacai.com.my/ListPastResult");
  if (!t) return [];
  try {
    const j = JSON.parse(t);
    return String(j.drawdate || "").trim().split(/\s+/).filter((d) => /^\d{8}$/.test(d));
  } catch { return []; }
}

/** One archived draw, or null. */
async function drawFor(yyyymmdd) {
  try {
    const metaTxt = await getText("https://www.damacai.com.my/callpassresult?pastdate=" + yyyymmdd);
    if (!metaTxt) return null;
    const link = JSON.parse(metaTxt).link;
    if (!link) return null;
    const body = await getText(link);
    if (!body) return null;
    const d = JSON.parse(body);
    return is4(d.p1) ? d : null;
  } catch { return null; }
}

async function main() {
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  let gIdx = db.games.findIndex((g) => /Da Ma Cai 1\+3D/i.test(g.name));
  if (gIdx < 0) {
    db.games.push({ name: "Da Ma Cai 1+3D 大馬彩", logo: "/sites/mkt88/app/theme-assets/images/logo_damacai.gif?v=1", table: "table-4" });
    gIdx = db.games.length - 1;
  }

  const have = new Set();
  const daysWithFirst = new Set();
  for (const num of Object.keys(db.hits)) {
    for (const [dd, g, c] of db.hits[num]) {
      have.add(num + "|" + dd + "|" + g + "|" + c);
      if (g === gIdx && c === 0) daysWithFirst.add(db.dayBase + dd);
    }
  }
  const push = (num, iso, cat) => {
    if (!is4(num)) return 0;
    const day = epochDay(iso);
    const dd = day - db.dayBase;
    if (have.has(num + "|" + dd + "|" + gIdx + "|" + cat)) return 0;
    have.add(num + "|" + dd + "|" + gIdx + "|" + cat);
    (db.hits[num] || (db.hits[num] = [])).push([dd, gIdx, cat]);
    return 1;
  };

  const argOf = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
  const only = argOf("--only");          // one date, for checking
  const limit = Number(argOf("--limit")) || 0;

  const all = await listDates();
  let wanted = all.filter((d) => !daysWithFirst.has(epochDay(d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8))));
  if (only) wanted = wanted.filter((d) => d === only);
  if (limit > 0) wanted = wanted.slice(0, limit);
  console.log(`archive has ${all.length} draw dates (${all[0]} .. ${all[all.length - 1]}); ${wanted.length} still missing from the DB`);

  let added = 0, draws = 0, oldest = null, failed = 0, done = 0;
  let idx = 0;
  const CONC = 4;
  async function worker() {
    while (idx < wanted.length) {
      const d = wanted[idx++];
      const rec = await drawFor(d);
      done++;
      if (!rec) { failed++; }
      else {
        const iso = d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8);
        const local = (rec.drawDate || "").split("/");
        const iso2 = local.length === 3 ? local[2] + "-" + local[1].padStart(2, "0") + "-" + local[0].padStart(2, "0") : iso;
        draws++;
        if (!oldest || iso2 < oldest) oldest = iso2;
        added += push(rec.p1, iso2, 0);
        added += push(rec.p2, iso2, 1);
        added += push(rec.p3, iso2, 2);
        for (const n of rec.starterList || []) added += push(n, iso2, 3);
        for (const n of rec.consolidateList || []) added += push(n, iso2, 4);
      }
      if (done % 250 === 0) console.error(`  ${done}/${wanted.length} checked, ${draws} draws, ${added} hits added`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()));

  if (oldest && oldest < db.meta.from) db.meta.from = oldest;
  const newest = all.length ? all[all.length - 1].slice(0, 4) + "-" + all[all.length - 1].slice(4, 6) + "-" + all[all.length - 1].slice(6, 8) : null;
  if (newest && newest > db.meta.to) db.meta.to = newest;
  db.meta.days = Math.round((Date.parse(db.meta.to + "T00:00:00Z") - Date.parse(db.meta.from + "T00:00:00Z")) / 86400000) + 1;
  db.meta.sources = [...new Set([...(db.meta.sources || ["live4dresult.net"]), "damacai.com.my (official, 2005+)"])];
  db.meta.built = new Date().toISOString();
  fs.writeFileSync(DB_FILE, JSON.stringify(db));

  console.log(`Da Ma Cai: ${draws} draws stored (oldest ${oldest}), ${failed} dates unreadable, ${added} hits added`);
  console.log(`DB now ${Math.round(fs.statSync(DB_FILE).size / 1024)} KB - from ${db.meta.from} to ${db.meta.to}`);
}

main().catch((e) => { console.error(e); process.exit(1); });