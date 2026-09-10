import { NextResponse } from "next/server";

/**
 * Fast Perdana + Lucky HariHari feed.
 * One request (10s server cache) instead of the 4-6 sequential upstream calls
 * the client used to make, so the cards fill in as soon as the page opens.
 */
export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const TTL = 10000;

type Set = { prize: string[]; special: string[]; cons: string[]; date?: string; drawNo?: string };
type Resp = {
  date: string;
  perdana: Record<string, Set | null>;
  hari: Record<string, { set: Set; six: { main: string; subs: Record<string, string> } | null; jp: Record<string, string> | null } | null>;
};

let cache: { at: number; data: Resp } | null = null;

function myDate(offsetDays = 0): { iso: string; noPad: string } {
  const now = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now).split("-");
  const [y, m, d] = parts;
  return { iso: `${y}-${m}-${d}`, noPad: `${y}-${Number(m)}-${Number(d)}` };
}

function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split("-");
  const dt = new Date(iso + "T12:00:00");
  const wk = isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US", { weekday: "short" });
  return `${d}-${m}-${y} (${wk})`;
}

async function get(url: string, json = false): Promise<any> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" }, cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    return json ? await res.json() : await res.text();
  } catch { return null; }
}

function textLines(html: string): string[] {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, "\n").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .split("\n").map((l) => l.trim());
}

/** perdana4d.com past-results page -> { "15:30": Set, "19:30": Set } */
function parsePerdana(html: string, iso: string): Record<string, Set> {
  const lines = textLines(html);
  const out: Record<string, Set> = {};
  const markers: number[] = [];
  lines.forEach((l, i) => { if (/^\d{8}4D$/.test(l) || /^\d{12}4D$/.test(l)) markers.push(i); });
  for (let mi = 0; mi < markers.length; mi++) {
    const start = markers[mi];
    const end = mi + 1 < markers.length ? markers[mi + 1] : lines.length;
    const block = lines.slice(start, end);
    const timeLine = block.slice(1, 10).find((l) => /^(\d{1,2}:\d{2})$/.test(l));
    if (!timeLine) continue;
    const pIdx = block.findIndex((l) => /^3rd Prize$/i.test(l));
    const sIdx = block.findIndex((l) => /^Special$/i.test(l));
    const cIdx = block.findIndex((l) => /^Consolation$/i.test(l));
    const eIdx = block.findIndex((l) => /^(2D|3D|6D) Results$/i.test(l));
    const grab = (from: number, to: number): string[] => {
      const vals: string[] = [];
      for (let i = from; i < to; i++) {
        const l = block[i];
        if (!l) continue;
        const cmb = /^\([A-Z]\)\s*(----|\d{4})$/.exec(l);
        if (cmb) { vals.push(cmb[1]); continue; }
        if (/^(----|\d{4})$/.test(l)) { vals.push(l); continue; }
        if (/^\([A-Z]\)$/.test(l) && i + 1 < to) {
          const nv = /^(----|\d{4})$/.exec(block[i + 1]);
          if (nv) { vals.push(nv[1]); i++; }
        }
      }
      return vals;
    };
    const prize: string[] = [];
    if (pIdx >= 0 && sIdx > pIdx) {
      for (let i = pIdx + 1; i < sIdx && prize.length < 3; i++) {
        const cmb = /^\([A-Z]\)\s*(----|\d{4})$/.exec(block[i]);
        if (cmb) { prize.push(cmb[1]); continue; }
        if (/^(----|\d{4})$/.test(block[i])) { prize.push(block[i]); continue; }
      }
    }
    while (prize.length < 3) prize.unshift("----");
    const special = sIdx >= 0 ? grab(sIdx + 1, cIdx > sIdx ? cIdx : eIdx > sIdx ? eIdx : block.length) : [];
    const cons = cIdx >= 0 ? grab(cIdx + 1, eIdx > cIdx ? eIdx : block.length) : [];
    out[timeLine] = { prize, special, cons, date: weekdayOf(iso) };
  }
  return out;
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
const CONS = ["N", "O", "P", "Q", "R", "S", "T", "U", "V", "W"];

function hariSet(j: any, iso: string): Set | null {
  if (!j || !j.prize1) return null;
  const special = LETTERS.map((L) => String(j["prize" + L] ?? "----"));
  const cons = CONS.map((L) => String(j["prize" + L] ?? "----"));
  return { prize: [j.prize1, j.prize2, j.prize3].map(String), special, cons, date: weekdayOf(iso), drawNo: j.id != null ? String(j.id) : undefined };
}

function hariSix(j: any) {
  if (!j || !j.prize6D) return null;
  const main = String(j.prize6D);
  const subs: Record<string, string> = {};
  for (const k of ["2A", "2B", "3A", "3B", "4A", "4B", "5A", "5B"]) subs["six_" + k.toLowerCase()] = String(j["prize6D_" + k] ?? "----");
  return { main, subs };
}

async function hariFor(time: "15:30" | "19:30", iso: string, noPad: string) {
  const j = await get(`https://api.hari4d.com/DrawResultL/GetDrawResult?date=${noPad}T${time}:00`, true);
  const set = hariSet(j, iso);
  if (!set || !set.prize.some((v) => v && v !== "----")) return null;
  const jpRaw = await get(`https://api.hari4d.com/Jackpot/GetJackpot?date=${noPad}T${time}:00`, true);
  let jp: Record<string, string> | null = null;
  if (jpRaw && jpRaw.jackpotAmount != null) {
    jp = { jp_pool: "USD " + Number(jpRaw.jackpotAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) };
    const nums: string[] = [];
    if (jpRaw.number) nums.push(String(jpRaw.number));
    if (jpRaw.number2) nums.push(String(jpRaw.number2));
    if (nums.length) jp.jp_no = nums.join(" or ");
  }
  return { set, six: hariSix(j), jp };
}

const isDash = (v: string) => /^----+$/.test((v || "").trim());

let warmer: ReturnType<typeof setInterval> | null = null;

/** Keep the cache warm in the background so a visitor never waits for the
 *  upstream sites (Render keeps this Node process alive). */
function startWarmer() {
  if (warmer) return;
  warmer = setInterval(() => { void build(); }, TTL);
  (warmer as unknown as { unref?: () => void }).unref?.();
}

async function build(): Promise<Resp> {
  const today = myDate(0);
  const yest = myDate(-1);

  const [perToday, perYest] = await Promise.all([
    get(`https://www.perdana4d.com/Results/4D?processDate=${today.iso}`),
    get(`https://www.perdana4d.com/Results/4D?processDate=${yest.iso}`),
  ]);

  const perdana: Record<string, Set | null> = { "15:30": null, "19:30": null };
  for (const [html, d] of [[perToday, today], [perYest, yest]] as [string | null, { iso: string; noPad: string }][]) {
    if (!html) continue;
    const sets = parsePerdana(html, d.iso);
    for (const time of ["15:30", "19:30"]) {
      const s = sets[time];
      if (s && s.prize.some((v) => v && !isDash(v)) && !perdana[time]) perdana[time] = s;
    }
  }

  const [h15, h19, h15y, h19y] = await Promise.all([
    hariFor("15:30", today.iso, today.noPad),
    hariFor("19:30", today.iso, today.noPad),
    hariFor("15:30", yest.iso, yest.noPad),
    hariFor("19:30", yest.iso, yest.noPad),
  ]);

  const data: Resp = {
    date: today.iso,
    perdana,
    hari: { "15:30": h15 || h15y, "19:30": h19 || h19y },
  };
  cache = { at: Date.now(), data };
  return data;
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) {
    startWarmer();
    return NextResponse.json(cache.data);
  }
  const data = await build();
  startWarmer();
  return NextResponse.json(data);
}

