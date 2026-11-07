import historyRaw from "../components/sites/mkt88/app/number-history-db.json";

type HistoryRow = [number, number, number];
type HistoryDb = {
  games: { name: string; logo: string; table: string }[];
  dayBase: number;
  hits: Record<string, HistoryRow[]>;
};

const db = historyRaw as unknown as HistoryDb;
const DAY0 = Date.UTC(2020, 0, 1);
const DAY_MS = 86400000;
const PRIZE_LABELS = ["1st Prize 首奖", "2nd Prize 二奖", "3rd Prize 三奖"];
const PRIZE_IDS = ["first_prize", "second_prize", "third_prize"];
const TABLES = [
  "table-1", "table-2", "table-3", "table-4", "table-5", "table-6",
  "table-7", "table-8", "table-9", "table-10", "table-11",
];
const GRID_COUNTS: Record<string, [number, number]> = {
  "table-4": [10, 10],
  "table-5": [12, 12],
  "table-11": [10, 10],
};

const esc = (value: unknown) =>
  String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function isoDay(offset: number): string {
  return new Date(DAY0 + offset * DAY_MS).toISOString().slice(0, 10);
}

function offsetFor(date: string): number {
  return Math.round((Date.parse(date + "T00:00:00Z") - DAY0) / DAY_MS) - db.dayBase;
}

function labelDate(date: string): string {
  const [y, m, d] = date.split("-");
  const weekday = new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  return `${d}-${m}-${y} (${weekday})`;
}

function localLogo(src: string): string {
  const path = String(src || "");
  return path.startsWith("/theme-assets/") ? "/sites/mkt88/app" + path : path;
}

function number(value: unknown): string {
  const text = String(value ?? "").trim();
  return /^\d{4}$/.test(text) ? text : "----";
}

function tableMeta() {
  const out = new Map<string, { name: string; logo: string }>();
  for (const game of db.games) {
    if (TABLES.includes(game.table) && !out.has(game.table)) {
      out.set(game.table, { name: game.name, logo: localLogo(game.logo) });
    }
  }
  return out;
}

const META = tableMeta();
let dateTablesCache: Record<string, string[]> | null = null;

/** Dates and cards held by the app's own Number History archive. */
export function localHistoryDateTables(): Record<string, string[]> {
  if (dateTablesCache) return dateTablesCache;
  const map = new Map<number, Set<string>>();
  for (const rows of Object.values(db.hits)) {
    for (const [dayOffset, gameIndex] of rows) {
      const table = db.games[gameIndex]?.table;
      if (!TABLES.includes(table)) continue;
      let tables = map.get(dayOffset);
      if (!tables) map.set(dayOffset, tables = new Set());
      tables.add(table);
    }
  }
  const out: Record<string, string[]> = {};
  for (const [offset, tables] of [...map.entries()].sort((a, b) => a[0] - b[0])) {
    out[isoDay(db.dayBase + offset)] = TABLES.filter((table) => tables.has(table));
  }
  dateTablesCache = out;
  return out;
}

function grid(title: string, prefix: string, values: string[], count: number): string {
  const cells = Array.from({ length: count }, (_, i) => number(values[i]));
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

function card(table: string, date: string, values: string[][]): string {
  const meta = META.get(table);
  if (!meta || !values.some((list) => list.some((value) => /^\d{4}$/.test(value)))) return "";
  const [specialCount, consCount] = GRID_COUNTS[table] || [13, 10];
  const prizes = Array.from({ length: 3 }, (_, i) => number(values[i]?.[0])).map((value, i) =>
    `<tr><td width="45%" class="lottery-prize-title text-center">${esc(PRIZE_LABELS[i])}</td><td class="lottery-prize-number border text-center" data-id="${PRIZE_IDS[i]}">${value}</td></tr>`
  ).join("");
  return (
    `<div class="col-12 col-sm-12 col-md-6 col-lg-4 mt-3 px-1">` +
      `<div class="card outer-box ${table} mkt-past" id="${table}-${date}">` +
        `<div class="card-body p-2">` +
          `<div class="row mx-0 align-items-center justify-content-center position-relative">` +
            (meta.logo ? `<div class="lottery-logo"><img src="${esc(meta.logo)}" alt="logo" loading="lazy"></div>` : "") +
            `<div class="lottery-name">${esc(meta.name)}</div>` +
          `</div>` +
          `<div class="row mx-0 justify-content-between"><div class="date">Date: <span data-id="date">${esc(labelDate(date))}</span></div></div>` +
          `<table class="my-1" width="100%"><tbody>${prizes}</tbody></table>` +
          grid("Special 特别奖", "special", values[3] || [], specialCount) +
          grid("Consolation 安慰奖", "consolation", values[4] || [], consCount) +
        `</div>` +
      `</div>` +
    `</div>`
  );
}

/**
 * Rebuild one past date from the app's own archive. Missing cells stay as
 * "----"; another date's result is never substituted.
 */
export function buildLocalPastHtml(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const target = offsetFor(date);
  const byTable = new Map<string, string[][]>();
  for (const [num, rows] of Object.entries(db.hits)) {
    for (const [dayOffset, gameIndex, prizeIndex] of rows) {
      if (dayOffset !== target) continue;
      const table = db.games[gameIndex]?.table;
      if (!TABLES.includes(table)) continue;
      let values = byTable.get(table);
      if (!values) byTable.set(table, values = [[], [], [], [], []]);
      if (prizeIndex >= 0 && prizeIndex < values.length) values[prizeIndex].push(num);
    }
  }
  const cards = TABLES.map((table) => card(table, date, byTable.get(table) || [])).filter(Boolean);
  return cards.length ? `<div class="row">${cards.join("")}</div>` : "";
}
