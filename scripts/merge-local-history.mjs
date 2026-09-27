// Merge the app's own stored past results into the number-history database.
// These files already live in the repo, so this is free and offline:
//   perdana-past.json   Perdana 4D (both daily draws, 2021-09-14 ->)
//   hari-4d-past.json   Lucky HariHari (2021-09-14 ->)
//   hari-past.json      Lucky HariHari (recent, both draw slots)
//   gd-nine-past.json   Grand Dragon + Nine Lotto (recent)
//
//   node scripts/merge-local-history.mjs
import fs from "node:fs";

const DB_FILE = "src/components/sites/live4dresult-net-0600c55d/root-8a5edab2/number-history-db.json";
const DAY0 = Date.UTC(2020, 0, 1);
const epochDay = (iso) => Math.round((Date.parse(iso + "T00:00:00Z") - DAY0) / 86400000);
const is4 = (v) => /^\d{4}$/.test(String(v || ""));

const read = (f) => JSON.parse(fs.readFileSync("src/lib/" + f, "utf8"));


function gameIndex(games, re, fallback) {
  let i = games.findIndex((g) => re.test(g.name));
  if (i < 0 && fallback) { games.push(fallback); i = games.length - 1; }
  return i;
}

function main() {
  const dbf = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  const have = new Set();
  for (const num of Object.keys(dbf.hits)) for (const [dd, g, c] of dbf.hits[num]) have.add(num + "|" + dd + "|" + g + "|" + c);
  const push = (num, iso, gIdx, cat) => {
    if (!is4(num)) return 0;
    const dd = epochDay(iso) - dbf.dayBase;
    if (have.has(num + "|" + dd + "|" + gIdx + "|" + cat)) return 0;
    have.add(num + "|" + dd + "|" + gIdx + "|" + cat);
    (dbf.hits[num] || (dbf.hits[num] = [])).push([dd, gIdx, cat]);
    return 1;
  };
  const gridNums = (grid, which) => {
    const hit = (grid || []).find(([t]) => new RegExp(which, "i").test(t));
    return hit ? hit[1] : [];
  };
  const addSet = (iso, gIdx, prize, grid) => {
    let n = 0;
    (prize || []).slice(0, 3).forEach((v, i) => { n += push(v, iso, gIdx, i); });
    for (const v of gridNums(grid, "Special")) n += push(v, iso, gIdx, 3);
    for (const v of gridNums(grid, "Consolation")) n += push(v, iso, gIdx, 4);
    return n;
  };

  const gPerdana = gameIndex(dbf.games, /Perdana/i);
  const gHari = gameIndex(dbf.games, /HariHari/i);
  const gGd = gameIndex(dbf.games, /Grand Dragon/i);
  const gNine = gameIndex(dbf.games, /Nine ?Lotto/i);
  console.log("game indexes -> perdana " + gPerdana + ", harihari " + gHari + ", granddragon " + gGd + ", nine " + gNine);

  let added = 0, days = 0;

  // Perdana: { d, p[3], g[[grid]], p2[3], g2[[grid]] }  (p2/g2 = the earlier draw)
  const per = read("perdana-past.json");
  for (const iso of Object.keys(per)) {
    const r = per[iso];
    added += addSet(iso, gPerdana, r.p, r.g);
    if (r.p2) added += addSet(iso, gPerdana, r.p2, r.g2);
    days++;
  }
  console.log("perdana-past: " + days + " days, " + added + " hits so far");

  // HariHari 4D store: { d, p[3], g[[grid]] }
  const h4 = read("hari-4d-past.json");
  let h4days = 0;
  for (const iso of Object.keys(h4)) { added += addSet(iso, gHari, h4[iso].p, h4[iso].g); h4days++; }
  console.log("hari-4d-past: " + h4days + " days, " + added + " hits so far");

  // HariHari live store: { days: { iso: { "15:30": {set}, "19:30": {set} } } }
  const hp = read("hari-past.json");
  let hpdays = 0;
  for (const iso of Object.keys(hp.days || {})) {
    for (const slot of Object.keys(hp.days[iso] || {})) {
      const s = hp.days[iso][slot].set;
      if (s) added += addSet(iso, gHari, s.prize, [["Special", s.special || []], ["Consolation", s.cons || []]]);
    }
    hpdays++;
  }
  console.log("hari-past: " + hpdays + " days, " + added + " hits so far");

  // Grand Dragon + Nine Lotto bundle
  const gn = read("gd-nine-past.json");
  let gndays = 0;
  for (const iso of Object.keys(gn)) {
    const r = gn[iso];
    if (r.gd) added += addSet(iso, gGd, (r.gd.prize || []), [["Special", r.gd.special || []], ["Consolation", r.gd.cons || []]]);
    else {
      for (const v of (r.gd && r.gd.special) || []) added += push(v, iso, gGd, 3);
    }
    if (r.nine) added += addSet(iso, gNine, (r.nine.prize || []), [["Special", r.nine.special || []], ["Consolation", r.nine.cons || []]]);
    gndays++;
  }
  console.log("gd-nine-past: " + gndays + " days, " + added + " hits so far");

  dbf.meta.sources = [...new Set([...(dbf.meta.sources || []), "app stored history (perdana/harihari/gd/nine)"])];
  dbf.meta.built = new Date().toISOString();
  fs.writeFileSync(DB_FILE, JSON.stringify(dbf));
  console.log("merged: " + added + " hits added -> DB " + Math.round(fs.statSync(DB_FILE).size / 1024) + " KB");
}

main();