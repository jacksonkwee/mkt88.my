// Collect the official Perdana 4D draws.
//
// The site's host cannot reach perdana4d.com (Cloudflare refuses its address)
// and a browser cannot read it either (no CORS), so this runs on a free GitHub
// runner instead and stores what it finds in the repo. Run:
//   node scripts/fetch-perdana-official.mjs
import fs from "node:fs";

const OUT = "src/lib/perdana-official.json";
const ARCHIVE = "src/lib/perdana-past.json";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const KEEP_DAYS = 60;

const KL = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const pretty = (iso) => { const [y, m, d] = iso.split("-"); const dt = new Date(iso + "T12:00:00Z"); return `${d}-${m}-${y} (${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dt.getUTCDay()]})`; };

/** Values live in 4dFirst / 4dSecond / 4dThird and fourDPosition attributes. */
function parse(html) {
  const out = {};
  for (const block of html.split(/(?=\d{12}4D|\d{8}4D)/).slice(1)) {
    const time = (block.match(/>(\d{1,2}:\d{2})</) || [])[1];
    if (!time) continue;
    const val = (re) => { const m = re.exec(block); return m && m[1] ? m[1] : "----"; };
    const cell = (cls) => val(new RegExp('class="[^"]*' + cls + '"[^>]*>\\s*(?:\\([A-Z]\\)\\s*)?(----|\\d{4})'));
    const byPos = (letters) => [...letters].map((L) => val(new RegExp('fourDPosition="[^"]*' + L + '"[^>]*>\\s*(?:\\([A-Z]\\)\\s*)?(----|\\d{4})')));
    const prize = [cell("4dFirst"), cell("4dSecond"), cell("4dThird")];
    if (!prize.some((v) => !/^----+$/.test(v))) continue;
    out[time] = { prize, special: byPos("ABCDEFGHIJKLM"), cons: byPos("NOPQRSTUVW") };
  }
  return out;
}

async function page(iso) {
  try {
    const r = await fetch("https://www.perdana4d.com/Results/4D?processDate=" + iso, { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, signal: AbortSignal.timeout(25000) });
    if (!r.ok) return { ok: false, why: "HTTP " + r.status };
    const html = await r.text();
    const draws = parse(html);
    return { ok: true, draws, bytes: html.length };
  } catch (e) { return { ok: false, why: String(e && e.message || e) }; }
}

const store = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { days: {} };
store.days = store.days || {};
const before = JSON.stringify(store.days || {});

const dates = [KL(new Date()), KL(new Date(Date.now() - 86400000))];
for (const iso of dates) {
  const res = await page(iso);
  if (!res.ok) { console.log(`${iso}: could not read (${res.why})`); continue; }
  const times = Object.keys(res.draws);
  if (!times.length) { console.log(`${iso}: page read (${res.bytes} bytes) but no draw published yet`); continue; }
  store.days[iso] = { ...(store.days[iso] || {}), ...res.draws };
  console.log(`${iso}: ${times.map((t) => t + " " + res.draws[t].prize.join("/")).join("   |   ")}`);
}

// keep the file small
const keep = Object.keys(store.days).sort().slice(-KEEP_DAYS);
for (const d of Object.keys(store.days)) if (!keep.includes(d)) delete store.days[d];
store.updated = new Date().toISOString();

/** The rolling file keeps only KEEP_DAYS; anything older is read from the
 *  permanent archive, so each finished day must be moved across before it is
 *  pruned. That prune is what used to leave holes in past results. */
function foldArchive(days) {
  if (!fs.existsSync(ARCHIVE)) return 0;
  const archive = JSON.parse(fs.readFileSync(ARCHIVE, "utf8"));
  let moved = 0;
  for (const [iso, times] of Object.entries(days)) {
    if (archive[iso]) continue;
    const set = times && times["19:30"];
    if (!set || !Array.isArray(set.prize) || !set.prize.some((v) => /^\d{4}$/.test(v))) continue;
    const grid = (s) => {
      const special = (s.special || []).filter((v) => /^\d{4}$/.test(v)).slice(0, 10);
      return [
        ["Special 特別獎", special.concat(Array(13 - special.length).fill("----"))],
        ["Consolation 安慰獎", (s.cons || []).filter((v) => /^\d{4}$/.test(v)).slice(0, 10)],
      ];
    };
    archive[iso] = { d: pretty(iso), p: set.prize.slice(0, 3), g: grid(set) };
    // Keep the day's earlier draw beside the evening one, so a slow official
    // page can never blank a past date.
    const morning = times["15:30"];
    if (morning && Array.isArray(morning.prize) && morning.prize.some((v) => /^\d{4}$/.test(v))) {
      archive[iso].p2 = morning.prize.slice(0, 3);
      archive[iso].g2 = grid(morning);
    }
    moved++;
  }
  if (!moved) return 0;
  const sorted = {};
  for (const k of Object.keys(archive).sort()) sorted[k] = archive[k];
  const tmp = ARCHIVE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(sorted), "utf8");
  JSON.parse(fs.readFileSync(tmp, "utf8")); // never swap a good file for a broken one
  fs.renameSync(tmp, ARCHIVE);
  console.log("archive: added " + moved + " day(s) to " + ARCHIVE);
  return moved;
}

const daysChanged = JSON.stringify(store.days) !== before;
const moved = foldArchive(store.days);
if (!daysChanged && !moved) { console.log("no change - nothing written"); process.exit(0); }
if (daysChanged) {
  fs.writeFileSync(OUT, JSON.stringify(store, null, 1));
  console.log("written " + OUT + "  (" + Math.round(fs.statSync(OUT).size / 1024) + " KB, " + Object.keys(store.days).length + " days)");
}