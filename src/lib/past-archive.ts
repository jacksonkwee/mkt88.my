import { firestoreGet, firestorePut, pushConfigured } from "./fcm";
import type { Snapshot } from "./live-snapshot";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

type ArchivedPast = { date: string; html: string; at: number };
type FirestoreJson = { fields?: { json?: { stringValue?: string } } };

const DOC_PREFIX = "past-results/";
const STORE_FILE = process.env.MKT88_PAST_STORE || path.join(process.cwd(), "data", "past-archive.json");
const DAILY_DIR = process.env.MKT88_PAST_STORE_DAILY || path.join(path.dirname(STORE_FILE), "past-days");
const TABLES = ["table-1", "table-4", "table-6", "table-8", "table-9", "table-10", "table-11"];
const META: Record<string, { name: string; logo: string; special: number; cons: number }> = {
  "table-1": { name: "Magnum 4D 万能", logo: "/sites/mkt88/app/theme-assets/images/logo_magnum.gif?v=1", special: 13, cons: 10 },
  "table-4": { name: "Da Ma Cai 1+3D 大马彩", logo: "/sites/mkt88/app/theme-assets/images/logo_damacai.gif?v=1", special: 10, cons: 10 },
  "table-6": { name: "SportsToto 4D 多多", logo: "/sites/mkt88/app/theme-assets/images/logo_toto.gif?v=1", special: 13, cons: 10 },
  "table-8": { name: "Sandakan 4D 山打根赛马会", logo: "/sites/mkt88/app/theme-assets/images/logo_stc4d.gif?v=1", special: 13, cons: 10 },
  "table-9": { name: "Special CashSweep 砂拉越大万", logo: "/sites/mkt88/app/theme-assets/images/logo_cashsweep.gif?v=1", special: 10, cons: 10 },
  "table-10": { name: "Sabah 88 4D 沙巴万字", logo: "/sites/mkt88/app/theme-assets/images/logo_sabah88.gif?v=1", special: 13, cons: 10 },
  "table-11": { name: "Singapore 4D", logo: "/sites/mkt88/app/logo_singapore4d.png", special: 10, cons: 10 },
};
const PRIZE_IDS = ["first_prize", "second_prize", "third_prize"];
const PRIZE_LABELS = ["1st Prize 首奖", "2nd Prize 二奖", "3rd Prize 三奖"];

let lastArchive: { date: string; html: string; at: number } | null = null;
let lastCloudAt = 0;
const readCache = new Map<string, { at: number; value: ArchivedPast | null }>();
let fileStore: Record<string, ArchivedPast> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const esc = (value: unknown) =>
  String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function num(value: unknown): string {
  const text = String(value ?? "").trim();
  return /^\d{4}$/.test(text) ? text : "----";
}

function todayKl(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function drawDate(cards: Snapshot["cards"]): string {
  let newest = "";
  for (const table of TABLES) {
    const label = String(cards[table]?.date || "");
    const match = /^(\d{2})-(\d{2})-(\d{4})/.exec(label);
    if (match) {
      const iso = `${match[3]}-${match[2]}-${match[1]}`;
      if (iso > newest) newest = iso;
    }
  }
  return newest || todayKl();
}

function grid(title: string, prefix: string, values: string[], count: number): string {
  const cells = Array.from({ length: count }, (_, i) => num(values[i]));
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 5) {
    rows.push(
      "<tr>" +
      cells.slice(i, i + 5)
        .map((value, j) => `<td width="20%" class="border text-center lottery-number" data-id="${prefix}-${i + j + 1}">${value}</td>`)
        .join("") +
      "</tr>"
    );
  }
  return `<table class="my-1" width="100%"><tbody><tr><td colspan="5" class="lottery-prize-title text-center">${esc(title)}</td></tr>${rows.join("")}</tbody></table>`;
}

function render(cards: Snapshot["cards"], date: string): string {
  const blocks: string[] = [];
  for (const table of TABLES) {
    const values = cards[table];
    const meta = META[table];
    if (!values || !meta) continue;
    const specials = Array.from({ length: meta.special }, (_, i) => num(values[`special-${i + 1}`]));
    const cons = Array.from({ length: meta.cons }, (_, i) => num(values[`consolation-${i + 1}`]));
    const prizes = PRIZE_IDS.map((id) => num(values[id]));
    if (![...prizes, ...specials, ...cons].some((value) => /^\d{4}$/.test(value))) continue;
    const prizeRows = prizes.map((value, i) =>
      `<tr><td width="45%" class="lottery-prize-title text-center">${PRIZE_LABELS[i]}</td><td class="lottery-prize-number border text-center" data-id="${PRIZE_IDS[i]}">${value}</td></tr>`
    ).join("");
    blocks.push(
      `<div class="col-12 col-sm-12 col-md-6 col-lg-4 mt-3 px-1">` +
        `<div class="card outer-box ${table} mkt-past" id="${table}-${date}">` +
          `<div class="card-body p-2">` +
            `<div class="row mx-0 align-items-center justify-content-center position-relative">` +
              `<div class="lottery-logo"><img src="${esc(meta.logo)}" alt="logo" loading="lazy"></div>` +
              `<div class="lottery-name">${esc(meta.name)}</div>` +
            `</div>` +
            `<div class="row mx-0 justify-content-between"><div class="date">Date: <span data-id="date">${esc(values.date || date)}</span></div></div>` +
            `<table class="my-1" width="100%"><tbody>${prizeRows}</tbody></table>` +
            grid("Special 特别奖", "special", specials, meta.special) +
            grid("Consolation 安慰奖", "consolation", cons, meta.cons) +
          `</div>` +
        `</div>` +
      `</div>`
    );
  }
  return blocks.length ? `<div class="row">${blocks.join("")}</div>` : "";
}

async function readFileStore(): Promise<Record<string, ArchivedPast>> {
  if (fileStore) return fileStore;
  try {
    const parsed = JSON.parse(await readFile(STORE_FILE, "utf8")) as Record<string, ArchivedPast>;
    fileStore = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    fileStore = {};
  }
  return fileStore;
}

async function saveDailyFile(entry: ArchivedPast): Promise<boolean> {
  try {
    await mkdir(DAILY_DIR, { recursive: true });
    const file = path.join(DAILY_DIR, entry.date + ".json");
    const temp = file + ".tmp";
    await writeFile(temp, JSON.stringify(entry), "utf8");
    await rename(temp, file);
    return true;
  } catch {
    return false;
  }
}

async function readDailyFile(date: string): Promise<ArchivedPast | null> {
  try {
    const entry = JSON.parse(await readFile(path.join(DAILY_DIR, date + ".json"), "utf8")) as ArchivedPast;
    return entry.date === date && /card outer-box/.test(entry.html) ? entry : null;
  } catch {
    return null;
  }
}

/** Save the settled live board into the app's own persistent history. */
export async function archiveLiveSnapshot(snapshot: Snapshot): Promise<void> {
  if (!snapshot.cards) return;
  const date = drawDate(snapshot.cards);
  const html = render(snapshot.cards, date);
  if (!html) return;
  if (lastArchive && lastArchive.date === date && lastArchive.html === html) return;
  if (lastArchive && lastArchive.date === date && Date.now() - lastArchive.at < 60_000) return;
  const entry = { date, html, at: snapshot.at };
  let saved = false;
  writeQueue = writeQueue.then(async () => {
    saved = await saveDailyFile(entry);
  }).catch(() => {});
  await writeQueue;
  if (pushConfigured() && Date.now() - lastCloudAt >= 5 * 60_000) {
    saved = await firestorePut(DOC_PREFIX + date, { json: JSON.stringify(entry) }) || saved;
    if (saved) lastCloudAt = Date.now();
  }
  if (saved) {
    lastArchive = { date, html, at: Date.now() };
    readCache.set(date, { at: Date.now(), value: entry });
  }
}

/** Read a date this app captured itself, without calling another results site. */
export async function getArchivedPast(date: string): Promise<ArchivedPast | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const cached = readCache.get(date);
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.value;
  const daily = (await readDailyFile(date)) || (await readFileStore())[date];
  if (daily && /card outer-box/.test(daily.html)) {
    readCache.set(date, { at: Date.now(), value: daily });
    return daily;
  }
  if (!pushConfigured()) return null;
  try {
    const doc = await firestoreGet<FirestoreJson>(DOC_PREFIX + date);
    const raw = doc?.fields?.json?.stringValue || "";
    const parsed = raw ? JSON.parse(raw) as ArchivedPast : null;
    const value = parsed && parsed.date === date && /card outer-box/.test(parsed.html) ? parsed : null;
    readCache.set(date, { at: Date.now(), value });
    return value;
  } catch {
    readCache.set(date, { at: Date.now(), value: null });
    return null;
  }
}
