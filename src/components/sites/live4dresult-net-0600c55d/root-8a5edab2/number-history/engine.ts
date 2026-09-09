// Shared helpers for the Number History feature.
import raw from "../number-history-db.json";

export interface DBShape {
  meta: { from: string; to: string; days: number; built: string };
  games: { name: string; logo: string; table: string }[];
  dayBase: number;
  hits: Record<string, number[][]>;
}

export const DB = raw as unknown as DBShape;

export const PRIZE_NAMES = ["1st", "2nd", "3rd", "Special", "Consolation"] as const;
export type PrizeName = (typeof PRIZE_NAMES)[number];

const DAY0 = Date.UTC(2020, 0, 1);
export function epochDay(iso: string): number {
  return Math.round((Date.parse(iso + "T00:00:00Z") - DAY0) / 86400000);
}

export function isoFromEpoch(d: number): string {
  return new Date(DAY0 + d * 86400000).toISOString().slice(0, 10);
}

export function fmtEpoch(d: number): string {
  const iso = isoFromEpoch(d);
  const [y, m, dd] = iso.split("-");
  const dt = new Date(iso + "T12:00:00");
  const wk = isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US", { weekday: "short" });
  return `${dd}-${m}-${y} (${wk})`;
}

export function todayIso(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  } catch {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
}

export type Region = "M'sia" | "Sab, Sar" | "Spore" | "Others";

export function regionOf(tableId: string): Region {
  const t = (tableId || "").replace(/-\d{4}-\d{2}-\d{2}.*$/, "");
  if (t === "table-11") return "Spore";
  if (["table-8", "table-9", "table-10"].includes(t)) return "Sab, Sar";
  if (["table-1", "table-2", "table-3", "table-4", "table-5", "table-6", "table-7"].includes(t)) return "M'sia";
  return "Others";
}

export interface RawHit {
  date: string;        // ISO yyyy-mm-dd
  day: number;         // epoch day for sorting
  game: string;
  logo: string;
  table: string;
  prize: PrizeName;
}

const CAT_RE = /^\s*(1st|2nd|3rd)\s*Prize|^\s*(Special|Consolation)/i;

function cleanTxt(s: string): string {
  return (s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

/** Parse the HTML of a single result card into 4-digit prize hits. */
export function parseCardHtml(seg: string): { name: string; logo: string; table: string; dateIso: string | null; numbers: { num: string; prize: PrizeName }[] } {
  const nameM = seg.match(/lottery-name[^>]*>([\s\S]*?)<\/div>/);
  const name = cleanTxt(nameM ? nameM[1] : "");
  const logoM = seg.match(/lottery-logo[^>]*>\s*<img[^>]*src="([^"]+)"/);
  const logo = logoM ? logoM[1] : "";
  const tableM = seg.match(/class="card outer-box (table-[0-9][^"]*)"/);
  const table = tableM ? tableM[1] : "";
  const dateM = seg.match(/data-id="date">([^<]*)</);
  const dateLbl = dateM ? cleanTxt(dateM[1]) : "";
  // Date labels are like 08-09-2026 (Tue)
  const dateIso = /^(\d{2})-(\d{2})-(\d{4})/.exec(dateLbl);
  const iso = dateIso ? `${dateIso[3]}-${dateIso[2]}-${dateIso[1]}` : null;

  const cells = [...seg.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => ({ txt: cleanTxt(m[1]) }));
  const numbers: { num: string; prize: PrizeName }[] = [];
  let cat: PrizeName | null = null;
  for (const c of cells) {
    const labelM = CAT_RE.exec(c.txt);
    if (labelM) {
      const k = (labelM[1] || labelM[2] || "").toLowerCase();
      if (k === "1st" || k === "2nd" || k === "3rd") cat = PRIZE_NAMES[Number(k[0]) - 1];
      else if (k.startsWith("special")) cat = "Special";
      else if (k.startsWith("consolation")) cat = "Consolation";
      continue;
    }
    const v = c.txt.replace(/\s+/g, "");
    if (/^\d{4}$/.test(v) && cat) numbers.push({ num: v, prize: cat });
  }
  return { name, logo, table, dateIso: iso, numbers };
}

/** Split a page/date HTML into per-card segments. */
export function splitCards(html: string): string[] {
  const starts: number[] = [];
  const re = /class="card outer-box (table-[0-9][^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) starts.push(m.index);
  const segs: string[] = [];
  for (let k = 0; k < starts.length; k++) {
    const end = k + 1 < starts.length ? starts[k + 1] : html.length;
    segs.push(html.slice(starts[k], end));
  }
  return segs;
}

/** Walk one snapshot entry (already stored locally) for a number. */
export function hitsFromHtml(html: string, num: string, dateIso: string): RawHit[] {
  const out: RawHit[] = [];
  const day = epochDay(dateIso);
  for (const seg of splitCards(html)) {
    const card = parseCardHtml(seg);
    if (!card.name || !card.table) continue;
    const useDate = card.dateIso || dateIso;
    const d = epochDay(useDate);
    for (const n of card.numbers) {
      if (n.num === num) out.push({ date: useDate, day: d, game: card.name, logo: card.logo, table: card.table, prize: n.prize });
    }
  }
  return out;
}

/** Look a number up in the offline database. */
export function hitsFromDb(num: string): RawHit[] {
  const arr = DB.hits[num];
  if (!arr || !arr.length) return [];
  const out: RawHit[] = [];
  for (const [dd, g, c] of arr) {
    const game = DB.games[g];
    if (!game) continue;
    const day = DB.dayBase + dd;
    out.push({ date: isoFromEpoch(day), day, game: game.name, logo: game.logo, table: game.table, prize: PRIZE_NAMES[c] || "Special" });
  }
  return out;
}

/** Format an ISO date as DD-MM-YYYY (Day). */
export function fmtIso(iso: string): string {
  const [y, m, d] = iso.split("-");
  const dt = new Date(iso + "T12:00:00");
  const wk = isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US", { weekday: "short" });
  return `${d}-${m}-${y} (${wk})`;
}


