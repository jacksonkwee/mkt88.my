// One-time backfill for the historical Malaysia / Singapore cards.
//
// The app serves past results from its own archive. This script only fills
// dates that predate that archive; it is not called by the website at runtime.
//
//   node scripts/backfill-past-live4d2u.mjs 2024-04-07 2026-11-06 /var/lib/mkt88/past-archive.json
import fs from "node:fs";
import path from "node:path";

const FROM = process.argv[2] || "2024-04-07";
const TO = process.argv[3] || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const OUT = process.argv[4] || path.resolve("data/past-archive.json");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36";
const CONCURRENCY = 4;

const GAMES = [
  { table: "table-1", match: /Magnum 4D/i, name: "Magnum 4D 万能", logo: "/sites/mkt88/app/theme-assets/images/logo_magnum.gif?v=1", special: 13, cons: 10 },
  { table: "table-4", match: /Da Ma Cai/i, name: "Da Ma Cai 1+3D 大马彩", logo: "/sites/mkt88/app/theme-assets/images/logo_damacai.gif?v=1", special: 10, cons: 10 },
  { table: "table-6", match: /Sports Toto/i, name: "SportsToto 4D 多多", logo: "/sites/mkt88/app/theme-assets/images/logo_toto.gif?v=1", special: 13, cons: 10 },
  { table: "table-8", match: /Sandakan/i, name: "Sandakan 4D 山打根赛马会", logo: "/sites/mkt88/app/theme-assets/images/logo_stc4d.gif?v=1", special: 13, cons: 10 },
  { table: "table-9", match: /Cash\s*Sweep/i, name: "Special CashSweep 砂拉越大万", logo: "/sites/mkt88/app/theme-assets/images/logo_cashsweep.gif?v=1", special: 10, cons: 10 },
  { table: "table-10", match: /Sabah 88/i, name: "Sabah 88 4D 沙巴万字", logo: "/sites/mkt88/app/theme-assets/images/logo_sabah88.gif?v=1", special: 13, cons: 10 },
  { table: "table-11", match: /Singapore 4D/i, name: "Singapore 4D", logo: "/sites/mkt88/app/logo_singapore4d.png", special: 10, cons: 10 },
];

const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clean = (value) => String(value ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
const num = (value) => /^\d{4}$/.test(String(value ?? "").trim()) ? String(value).trim() : "----";

function datesBetween(from, to) {
  const out = [];
  for (let t = Date.parse(from + "T00:00:00Z"); t <= Date.parse(to + "T00:00:00Z"); t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

function outerBlocks(html) {
  const out = [];
  let from = 0;
  while (true) {
    const start = html.indexOf('<div class="outerbox">', from);
    if (start < 0) break;
    let depth = 0;
    let end = start;
    const re = /<\/?div\b[^>]*>/gi;
    re.lastIndex = start;
    let match;
    while ((match = re.exec(html))) {
      depth += /^<div/i.test(match[0]) ? 1 : -1;
      end = re.lastIndex;
      if (depth === 0) break;
    }
    if (end > start) out.push(html.slice(start, end));
    from = end || start + 1;
  }
  return out;
}

function grid(title, prefix, values, count) {
  const cells = Array.from({ length: count }, (_, i) => num(values[i]));
  const rows = [];
  for (let i = 0; i < cells.length; i += 5) {
    rows.push("<tr>" + cells.slice(i, i + 5).map((value, j) =>
      `<td width="20%" class="border text-center lottery-number" data-id="${prefix}-${i + j + 1}">${value}</td>`
    ).join("") + "</tr>");
  }
  return `<table class="my-1" width="100%"><tbody><tr><td colspan="5" class="lottery-prize-title text-center">${esc(title)}</td></tr>${rows.join("")}</tbody></table>`;
}

function renderCard(date, game, block) {
  const text = clean(block);
  if (!game.match.test(text)) return "";
  const dm = /Date:\s*(\d{2})-(\d{2})-(\d{4})/.exec(text);
  if (dm && `${dm[3]}-${dm[2]}-${dm[1]}` !== date) return "";
  const drawNo = (/Draw No:\s*([0-9/]+)/.exec(text) || [])[1] || "";
  const prizes = [...block.matchAll(/class="resulttop"[^>]*>\s*([^<]*?)\s*<\/td>/gi)].map((m) => num(m[1])).slice(0, 3);
  const specialAt = block.search(/Special\s/i);
  const consAt = block.search(/Consolation\s/i);
  const specialBlocks = specialAt >= 0 ? block.slice(specialAt, consAt > specialAt ? consAt : undefined) : "";
  const consBlocks = consAt >= 0 ? block.slice(consAt) : "";
  const special = [...specialBlocks.matchAll(/class="resultbottom"[^>]*>\s*([^<]*?)\s*<\/td>/gi)].map((m) => num(m[1]));
  const cons = [...consBlocks.matchAll(/class="resultbottom"[^>]*>\s*([^<]*?)\s*<\/td>/gi)].map((m) => num(m[1]));
  if (![...prizes, ...special, ...cons].some((value) => value !== "----")) return "";
  const prizeIds = ["first_prize", "second_prize", "third_prize"];
  const prizeLabels = ["1st Prize 首奖", "2nd Prize 二奖", "3rd Prize 三奖"];
  const prizeRows = prizeIds.map((id, i) =>
    `<tr><td width="45%" class="lottery-prize-title text-center">${prizeLabels[i]}</td><td class="lottery-prize-number border text-center" data-id="${id}">${prizes[i] || "----"}</td></tr>`
  ).join("");
  return (
    `<div class="col-12 col-sm-12 col-md-6 col-lg-4 mt-3 px-1">` +
      `<div class="card outer-box ${game.table} mkt-past" id="${game.table}-${date}">` +
        `<div class="card-body p-2">` +
          `<div class="row mx-0 align-items-center justify-content-center position-relative">` +
            `<div class="lottery-logo"><img src="${esc(game.logo)}" alt="logo" loading="lazy"></div>` +
            `<div class="lottery-name">${esc(game.name)}</div>` +
          `</div>` +
          `<div class="row mx-0 justify-content-between"><div class="date">Date: <span data-id="date">${esc(dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : date)}</span></div>${drawNo ? `<div class="date">Draw No: <span data-id="draw_no">${esc(drawNo)}</span></div>` : ""}</div>` +
          `<table class="my-1" width="100%"><tbody>${prizeRows}</tbody></table>` +
          grid("Special 特别奖", "special", special, game.special) +
          grid("Consolation 安慰奖", "consolation", cons, game.cons) +
        `</div>` +
      `</div>` +
    `</div>`
  );
}

async function pageFor(date) {
  const response = await fetch("https://www.live4d2u.net/past-results/" + date, {
    headers: { "user-agent": UA, accept: "text/html" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) return "";
  const html = await response.text();
  const blocks = outerBlocks(html);
  const cards = [];
  for (const game of GAMES) {
    const block = blocks.find((candidate) => game.match.test(clean(candidate)));
    if (!block) continue;
    const htmlCard = renderCard(date, game, block);
    if (htmlCard) cards.push(htmlCard);
  }
  return cards.length ? `<div class="row">${cards.join("")}</div>` : "";
}

const store = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const dates = datesBetween(FROM, TO);
let index = 0;
let saved = 0;
let found = 0;
let failed = 0;

async function worker() {
  while (index < dates.length) {
    const date = dates[index++];
    try {
      const html = await pageFor(date);
      if (!html) continue;
      found++;
      const current = String(store[date]?.html || "");
      if (current.split("card outer-box").length >= html.split("card outer-box").length) continue;
      store[date] = { date, html, at: Date.parse(date + "T23:59:59Z") };
      saved++;
      if (saved % 40 === 0) {
        fs.mkdirSync(path.dirname(OUT), { recursive: true });
        fs.writeFileSync(OUT, JSON.stringify(store), "utf8");
        console.log(`  saved ${saved} dates (${date})`);
      }
    } catch {
      failed++;
    }
  }
}

console.log(`Backfilling ${dates.length} dates from ${FROM} to ${TO}`);
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
const sorted = {};
for (const key of Object.keys(store).sort()) sorted[key] = store[key];
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(sorted), "utf8");
console.log(`Found ${found} result pages, updated ${saved} dates, ${failed} fetch failures`);
console.log(`Archive: ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
