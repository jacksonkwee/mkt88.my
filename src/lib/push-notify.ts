import { getSnapshot, type Snapshot } from "./live-snapshot";
import { firestoreDelete, firestoreGet, firestorePut, pushConfigured, registeredDevices, sendToTokens } from "./fcm";

/**
 * "This game's result is out" push notifications.
 *
 * The app can only remind a phone while it is running, so the reminder for a
 * closed phone has to come from here: every snapshot build is checked for games
 * whose 1st/2nd/3rd prizes have all just been published, and the phones that
 * registered are woken with the game's name.
 *
 * The check rides along with /api/home-live, which is edge-cached for a second
 * and polled by every open app (and by the PC's keep-warm job), so it costs no
 * extra traffic. A state document in Firestore remembers what has already been
 * announced, so a draw is only ever sent once - and a draw that finishes on a
 * later date is sent again.
 */

/** class -> the name the app shows for that game. */
const GAME_NAMES: Record<string, string> = {
  "table-1": "Magnum 4D 万能",
  "table-2": "Magnum Jackpot Gold 万能黄金万字积宝",
  "table-3": "Magnum Life 万能天天彩",
  "table-4": "Da Ma Cai 1+3D 大马彩",
  "table-5": "Da Ma Cai 3+3D 大马彩",
  "table-6": "SportsToto 4D 多多",
  "table-7": "SportsToto 5D, 6D, Lotto 多多六合彩",
  "table-8": "Sandakan 4D 山打根赛马会",
  "table-9": "Special Cash Sweep 砂拉越大万",
  "table-10": "Sabah 88 4D 沙巴万字",
  "table-11": "Singapore 4D 新加坡",
  "table-12": "Singapore Toto 新加坡多多",
  "table-13": "Grand Dragon 4D 豪龙",
  "table-17": "Nine Lotto 4D",
  "table-16": "Perdana Lottery 4D",
  "table-15": "Lucky HariHari 4D 天天好运",
};

const BODY: Record<string, string> = {
  en: "Live draw in progress · tap to see the latest results",
  ms: "Cabutan langsung sedang berjalan · ketik untuk keputusan terkini",
  zh: "现场开彩进行中 · 点击查看最新成绩",
};

/** A value the operator has actually drawn (4D, 3+3D, 2-digit Life numbers...). */
const isNum = (v?: string) => !!v && /^\d{1,6}$/.test(v.trim());

/** Today in Malaysia, in the label the cards print ("12-10-2026 (Mon)"). */
function myTodayLabel(): string {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
    }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    return `${p.day}-${p.month}-${p.year} (${p.weekday})`;
  } catch {
    return "";
  }
}

/** The cells that show a drawn number on a 4D-style card. */
function drawnCells(c: Record<string, string>): string[] {
  const ids = ["first_prize", "second_prize", "third_prize"];
  for (let i = 1; i <= 15; i++) ids.push("special-" + i);
  for (let i = 1; i <= 10; i++) ids.push("consolation-" + i);
  return ids.map((id) => c[id]).filter((v) => isNum(v));
}

/**
 * Every game whose draw has STARTED, as "<key>": "<draw date>".
 *
 * This used to wait for the 1st, 2nd and 3rd prizes, which are the last things
 * a draw publishes - so a 3:30PM Lucky draw was announced at 4:08PM (reported
 * 12 Oct 2026). The 4D games reveal their specials first, so "the board has
 * begun filling in" is what the reminder is for.
 */
export function readyNow(snap: Snapshot): Record<string, string> {
  const out: Record<string, string> = {};
  const today = myTodayLabel();
  for (const [cls, name] of Object.entries(GAME_NAMES)) {
    if (cls === "table-15" || cls === "table-16") continue;   // handled below
    const c = snap.cards ? snap.cards[cls] : undefined;
    if (!c || !name) continue;
    if (!/^\d{2}-\d{2}-\d{4}/.test((c.date || "").trim())) continue;
    if (today && (c.date || "").trim() !== today) continue;   // only today's draw
    if (!drawnCells(c).length) continue;                       // nothing out yet
    out[cls] = c.date.trim();
  }
  // Perdana (one 7:30PM draw) and HariHari (3:30PM and 7:30PM).
  const perdana = snap.perdana ? snap.perdana["19:30"] : null;
  if (perdana && perdana.date && (!today || perdana.date.trim() === today) &&
      [...(perdana.prize || []), ...(perdana.special || []), ...(perdana.cons || [])].some(isNum)) {
    out["table-16|19:30"] = perdana.date;
  }
  for (const t of ["15:30", "19:30"]) {
    const h = snap.hari ? snap.hari[t] : null;
    const set = h && h.set;
    if (set && set.date && (!today || set.date.trim() === today) &&
        [...(set.prize || []), ...(set.special || []), ...(set.cons || [])].some(isNum)) {
      out["table-15|" + t] = set.date;
    }
  }
  return out;
}

/** How long between checks, per serverless instance. */
const CHECK_MS = 15000;
let lastCheck = 0;

export type PushResult = { sent: number; games: string[]; devices?: number; skipped?: string };

export async function checkAndPush(opts: { force?: boolean } = {}): Promise<PushResult> {
  if (!pushConfigured()) return { sent: 0, games: [], skipped: "no FIREBASE_SERVICE_ACCOUNT" };
  const now = Date.now();
  if (!opts.force && now - lastCheck < CHECK_MS) return { sent: 0, games: [], skipped: "throttled" };
  lastCheck = now;

  const snap = await getSnapshot({ wait: true });
  const ready = readyNow(snap);

  // What has already been announced. One JSON string in one document keeps this
  // to a single read and a single write per check.
  const prevDoc = await firestoreGet<{ fields?: { json?: { stringValue?: string } } }>("state/live");
  let prev: Record<string, string> = {};
  try { prev = JSON.parse(prevDoc?.fields?.json?.stringValue || "{}") as Record<string, string>; } catch { prev = {}; }

  const fresh = Object.entries(ready).filter(([k, v]) => prev[k] !== v);
  await firestorePut("state/live", { json: JSON.stringify(ready) });
  if (!fresh.length) return { sent: 0, games: [] };

  // Phones whose owner switched result alerts off in the app are skipped.
  const devices = (await registeredDevices()).filter((d) => d.alerts !== "0");
  if (!devices.length) return { sent: 0, games: fresh.map(([k]) => k) };

  const byLang = new Map<string, { id: string; token: string }[]>();
  for (const d of devices) {
    const lang = BODY[d.lang] ? d.lang : "en";
    const list = byLang.get(lang) || [];
    list.push({ id: d.id, token: d.token });
    byLang.set(lang, list);
  }

  let sent = 0;
  const dead: string[] = [];
  const games: string[] = [];
  for (const [key] of fresh) {
    const [cls, time] = key.split("|");
    const name = (GAME_NAMES[cls] || cls) + (time ? " " + time : "");
    games.push(name);
    for (const [lang, list] of byLang) {
      const r = await sendToTokens(list, name, BODY[lang] || BODY.en);
      sent += r.sent;
      for (const id of r.dead) if (!dead.includes(id)) dead.push(id);
    }
  }
  for (const id of dead) await firestoreDelete("devices/" + id);
  return { sent, games, devices: devices.length };
}
