// Merge official Sports Toto 4D past results (1992 -> mid-2022) into the
// number-history database. Run: node scripts/build-deep-history-st.mjs
import fs from "node:fs";

const DB_FILE = "src/components/sites/live4dresult-net-0600c55d/root-8a5edab2/number-history-db.json";
const START_YEAR = 1992;
const END_YEAR = 2022;
const END_MONTH = 6; // live4dresult archive takes over from 2022-07-27

const DAY0 = Date.UTC(2020, 0, 1);
const epochDay = (iso) => Math.round((Date.parse(iso + "T00:00:00Z") - DAY0) / 86400000);
const is4 = (v) => /^\d{4}$/.test(String(v || ""));

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function fetchMonth(m, y) {
  const url = `https://www.sportstoto.com.my/results_past.asp?date=${m}%2F1%2F${y}`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) return "";
  return await res.text();
}

const SECTION_END = ["TOTO 4D JACKPOT", "TOTO 4D ZODIAC", "Toto lotto games", "SUPER TOTO", "POWER TOTO", "STAR TOTO", "TOTO 6/", "TOTO 4/49", "TOTO 5D", "TOTO 6D", "TOTO 5/", "TOTO 6/"];

/** Parse one draw modal into 4D prize buckets. */
function parseModal(seg) {
  const dateM = /Draw Date\s*:\s*([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})/.exec(seg);
  if (!dateM) return null;
  const iso = `${dateM[3]}-${dateM[2].padStart(2, "0")}-${dateM[1].padStart(2, "0")}`;

  const start = seg.indexOf("TOTO 4D");
  if (start < 0) return null;
  let end = seg.length;
  for (const mk of SECTION_END) {
    const i = seg.indexOf(mk, start + 7);
    if (i > start && i < end) end = i;
  }
  const section = seg.slice(start, end);

  // only exact 4-digit cell contents (ignores 5D/6D and empty "0" cells)
  const cells = [...section.matchAll(/>\s*(\d{4})\s*</g)].map((x) => x[1]);
  const si = section.indexOf("Special Prize");
  const ci = section.indexOf("Consolation Prize");
  const before = cells.slice(0, cells.length); // positional fallback
  // Split by text position instead of cell order for robustness.
  const partTop = si > 0 ? section.slice(0, si) : "";
  const partSpecial = si > 0 ? section.slice(si, ci > si ? ci : section.length) : "";
  const partCons = si > 0 && ci > si ? section.slice(ci) : "";
  const nums = (html) => [...html.matchAll(/>\s*(\d{4})\s*</g)].map((x) => x[1]);

  const top = nums(partTop).slice(0, 3);
  const special = nums(partSpecial);
  const consolation = nums(partCons);
  if (!top.length && !before.length) return null;
  return { iso, top, special, consolation };
}

async function main() {
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  let gIdx = db.games.findIndex((g) => /sportstoto|sports ?toto/i.test(g.name));
  if (gIdx < 0) {
    db.games.push({ name: "SportsToto 4D 多多", logo: "/wp-content/themes/oldtheme-lottery-frontend/assets/images/logo_toto.gif?v=1", table: "table-6" });
    gIdx = db.games.length - 1;
  }

  const push = (num, iso, cat) => {
    if (!is4(num)) return 0;
    const arr = db.hits[num] || (db.hits[num] = []);
    arr.push([epochDay(iso) - db.dayBase, gIdx, cat]);
    return 1;
  };

  const months = [];
  for (let y = START_YEAR; y <= END_YEAR; y++) {
    const lastM = y === END_YEAR ? END_MONTH : 12;
    for (let m = 1; m <= lastM; m++) months.push([m, y]);
  }

  let added = 0, draws = 0, pages = 0, oldest = null;
  const CONC = 3;
  let idx = 0;
  async function worker() {
    while (idx < months.length) {
      const [m, y] = months[idx++];
      let html = "";
      try { html = await fetchMonth(m, y); } catch { html = ""; }
      pages++;
      if (!html) continue;
      const starts = [...html.matchAll(/id="myModal\d+"/g)].map((x) => x.index);
      for (let k = 0; k < starts.length; k++) {
        const seg = html.slice(starts[k] - 40, k + 1 < starts.length ? starts[k + 1] : html.length);
        const parsed = parseModal(seg);
        if (!parsed) continue;
        draws++;
        if (!oldest || parsed.iso < oldest) oldest = parsed.iso;
        if (parsed.top[0]) added += push(parsed.top[0], parsed.iso, 0);
        if (parsed.top[1]) added += push(parsed.top[1], parsed.iso, 1);
        if (parsed.top[2]) added += push(parsed.top[2], parsed.iso, 2);
        for (const n of parsed.special) added += push(n, parsed.iso, 3);
        for (const n of parsed.consolation) added += push(n, parsed.iso, 4);
      }
      if (pages % 40 === 0) console.error(`  ${pages} pages scanned (now ${y}-${String(m).padStart(2, "0")}), ${draws} draws`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()));

  db.meta.from = oldest && oldest < db.meta.from ? oldest : db.meta.from;
  db.meta.days = Math.round((Date.parse(db.meta.to + "T00:00:00Z") - Date.parse(db.meta.from + "T00:00:00Z")) / 86400000) + 1;
  db.meta.sources = [...new Set([...(db.meta.sources || ["live4dresult.net"]), "sportstoto.com.my (official, 1992+)"])];
  db.meta.built = new Date().toISOString();
  fs.writeFileSync(DB_FILE, JSON.stringify(db));

  const kb = Math.round(fs.statSync(DB_FILE).size / 1024);
  console.log(`SportsToto: ${draws} draws from ${pages} month pages (oldest ${oldest}), hits added ${added}`);
  console.log(`DB now ${kb} KB · from ${db.meta.from} to ${db.meta.to}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
