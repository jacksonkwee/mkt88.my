import { getSnapshot, type Snapshot } from "./live-snapshot";
import { firestoreDelete, firestoreGet, firestorePutIfUnchanged, pushConfigured, registeredDevices, sendToTokens } from "./fcm";
import { getSpecialDrawDates, SPECIAL_DRAW_TABLES } from "./special-draws";

/**
 * "This game's result is out" push notifications.
 *
 * Every snapshot build is checked here, and the phones that registered are
 * woken with the game's name. Each DRAW is announced once, at its first number:
 * no reminder per drawn number, and nothing repeated for the rest of that draw.
 * A game that runs two draw times (Perdana, Lucky HariHari) announces each.
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

/** Where tapping each game's reminder should open. */
const ROUTE_BY_GAME: Record<string, string> = {
  "table-1": "/result/magnum",
  "table-2": "/result/magnum-4d-jackpot",
  "table-3": "/result/magnum",
  "table-4": "/result/damacai",
  "table-5": "/result/damacai",
  "table-6": "/result/sportstoto",
  "table-7": "/result/sportstoto",
  "table-8": "/sabah-sarawak-4d-results?op=sandakan",
  "table-9": "/sabah-sarawak-4d-results?op=cashsweep",
  "table-10": "/sabah-sarawak-4d-results?op=sabah88",
  "table-11": "/singapore-4d-results",
  "table-12": "/singapore-4d-results",
  "table-13": "/result/grand-dragon",
  "table-17": "/result/nine-lotto",
  "table-16": "/result/perdana",
  "table-15": "/result/lucky-harihari",
};

/**
 * Which days each game runs and the window its numbers are being published in.
 *
 * A card only carries TODAY's date while that game's draw is actually under
 * way, so the date check alone looked watertight. It was not: on a day one
 * game draws, another game's card could still be showing today's date and the
 * reminder fired for it too - so a Monday, when only the daily Cambodia games
 * and Singapore Toto run, still buzzed for "Malaysia, Singapore and East
 * Malaysia" (reported 12 Oct 2026). The reminder now also has to be inside the
 * game's own draw window.
 *
 * Times are Malaysia time, minutes from midnight, matching the app's published
 * draw schedule. A special draw an operator announces on another day would
 * need its date added here, the same way the draw-schedule page lists it.
 */
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WSS_DAYS = [0, 3, 6];   // Wednesday, Saturday, Sunday
const TOTO_DAYS = [1, 4];     // Monday, Thursday
const DRAW_WINDOW: Record<string, { days: number[]; from: number; to: number }> = {
  // Daily Cambodia games.
  "table-13": { days: ALL_DAYS, from: 19 * 60, to: 21 * 60 + 30 },
  "table-17": { days: ALL_DAYS, from: 19 * 60, to: 21 * 60 + 30 },
  "table-15": { days: ALL_DAYS, from: 15 * 60 + 20, to: 21 * 60 + 30 },
  "table-16": { days: ALL_DAYS, from: 15 * 60 + 20, to: 21 * 60 + 30 },
  // Wednesday, Saturday, Sunday. Wednesday is 3, Sunday is 0.
  "table-1": { days: WSS_DAYS, from: 18 * 60 + 50, to: 21 * 60 },
  "table-2": { days: WSS_DAYS, from: 18 * 60 + 50, to: 21 * 60 },
  "table-3": { days: WSS_DAYS, from: 18 * 60 + 50, to: 21 * 60 },
  "table-4": { days: WSS_DAYS, from: 18 * 60 + 50, to: 21 * 60 },
  "table-5": { days: WSS_DAYS, from: 18 * 60 + 50, to: 21 * 60 },
  "table-6": { days: WSS_DAYS, from: 18 * 60 + 50, to: 21 * 60 },
  "table-7": { days: WSS_DAYS, from: 18 * 60 + 50, to: 21 * 60 },
  "table-8": { days: WSS_DAYS, from: 18 * 60 + 50, to: 21 * 60 },
  "table-9": { days: WSS_DAYS, from: 18 * 60 + 50, to: 21 * 60 },
  "table-10": { days: WSS_DAYS, from: 18 * 60 + 50, to: 21 * 60 },
  "table-11": { days: WSS_DAYS, from: 18 * 60 + 10, to: 21 * 60 },
  // Singapore Toto has its own days and is not on the 4D schedule.
  "table-12": { days: TOTO_DAYS, from: 18 * 60 + 10, to: 21 * 60 },
};

/** Today in Malaysia as "weekday index, minutes from midnight". */
function myNow(): { day: number; mins: number } {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kuala_Lumpur", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const day = Math.max(0, names.indexOf(p.weekday || ""));
  const mins = Number(p.hour || 0) * 60 + Number(p.minute || 0);
  return { day, mins };
}

/**
 * The window one Perdana / HariHari slot runs in ("15:30" or "19:30").
 *
 * Those games keep today's date on their board for the rest of the day, so the
 * game's whole 3:30PM-9:30PM span would still be "live" at 8:45PM and buzz for
 * a draw that finished hours earlier. Each slot is only live around its own
 * time.
 */
function inSlotWindow(slot: string, now = myNow()): boolean {
  if (slot === "15:30") return now.mins >= 15 * 60 + 20 && now.mins <= 16 * 60 + 45;
  return now.mins >= 19 * 60 + 20 && now.mins <= 21 * 60 + 30;
}

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

/** Today in Malaysia as YYYY-MM-DD, for matching the announced special dates. */
function myTodayIso(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** The cells that show a drawn number on a 4D-style card. */
function drawnCells(c: Record<string, string>): string[] {
  const ids = ["first_prize", "second_prize", "third_prize"];
  for (let i = 1; i <= 15; i++) ids.push("special-" + i);
  for (let i = 1; i <= 10; i++) ids.push("consolation-" + i);
  /*
   * Singapore Toto carries its six winning numbers and the additional number as
   * number_1..number_8 (the "+" sits in number_7), not the 4D grid, so it needs
   * its own ids to count as "a number is out" (asked for 13 Oct 2026).
   */
  for (let i = 1; i <= 8; i++) ids.push("number_" + i);
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
export function readyNow(snap: Snapshot, specialDates: string[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  const today = myTodayLabel();
  const todayIso = myTodayIso();
  const now = myNow();
  for (const [cls, name] of Object.entries(GAME_NAMES)) {
    if (cls === "table-15" || cls === "table-16") continue;   // handled below
    const win = DRAW_WINDOW[cls];
    const c = snap.cards ? snap.cards[cls] : undefined;
    if (!c || !name) continue;
    if (!/^\d{2}-\d{2}-\d{4}/.test((c.date || "").trim())) continue;
    if (today && (c.date || "").trim() !== today) continue;   // only today's draw
    if (!drawnCells(c).length) continue;                       // nothing out yet
    /*
     * The reminder may only fire on the game's own draw day and window.
     *
     * A card used to be trusted on its date alone, so on a Monday - when only
     * the daily Cambodia games and Singapore Toto draw - a stale Malaysia or
     * East Malaysia card stamped with today's date still buzzed (reported
     * 12 Oct 2026).
     *
     * Extra draws the operators announce - a Tuesday, for example - are
     * announced too: when the date is on the published list the weekday test is
     * skipped for those games, and the usual evening window still applies.
     * See /draw-schedule.
     */
    const special = specialDates.includes(todayIso) && SPECIAL_DRAW_TABLES.includes(cls);
    if (win && !((win.days.includes(now.day) || special) && now.mins >= win.from && now.mins <= win.to)) continue;
    out[cls] = c.date.trim();
  }
  /*
   * Perdana and HariHari each run a 3:30PM and a 7:30PM draw, and EACH of those
   * draws sends a reminder of its own - at the first number it publishes - like
   * every single-draw game does. What is never sent is a reminder per drawn
   * number: the key is the draw, so once a draw has announced, the rest of its
   * numbers stay quiet for the whole of that draw.
   */
  for (const t of ["15:30", "19:30"]) {
    const perdana = snap.perdana ? snap.perdana[t] : null;
    if (perdana && perdana.date && (!today || perdana.date.trim() === today) &&
        [...(perdana.prize || []), ...(perdana.special || []), ...(perdana.cons || [])].some(isNum) &&
        inSlotWindow(t, now)) {
      out["table-16|" + t] = perdana.date.trim();
    }
  }
  for (const t of ["15:30", "19:30"]) {
    const h = snap.hari ? snap.hari[t] : null;
    const set = h && h.set;
    if (set && set.date && (!today || set.date.trim() === today) &&
        [...(set.prize || []), ...(set.special || []), ...(set.cons || [])].some(isNum) &&
        inSlotWindow(t, now)) {
      out["table-15|" + t] = set.date.trim();
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
  // The dates are the ones the owner keeps in /admin, so a new special draw is
  // announced without a code change.
  const ready = readyNow(snap, await getSpecialDrawDates());

  // What has already been announced. One JSON string in one document keeps this
  // to a single read and a single write per check.
  const prevDoc = await firestoreGet<{ updateTime?: string; fields?: { json?: { stringValue?: string } } }>("state/live");
  let prev: Record<string, string> = {};
  try { prev = JSON.parse(prevDoc?.fields?.json?.stringValue || "{}") as Record<string, string>; } catch { prev = {}; }

  /*
   * A draw that has already been announced stays announced. The bare game key
   * ("table-16"), written by the one-reminder-a-day build that ran briefly on
   * 13 Oct 2026, also counts, so going back to a reminder per draw does not
   * fire a second one for a draw the phones have already had.
   */
  const announced = (k: string, v: string) => {
    if (prev[k] === v) return true;
    const base = k.split("|")[0];
    return base !== k && prev[base] === v;
  };
  const fresh = Object.entries(ready).filter(([k, v]) => !announced(k, v));
  /*
   * Keep every game we have already announced for its draw.
   *
   * The stored state used to be replaced by whatever the snapshot said right
   * now. When a board momentarily emptied - the gap between one draw being
   * cleared and the next number landing - its game disappeared from the state,
   * and the moment a number came back the SAME draw was announced a second
   * time (reported 13 Oct 2026 for Perdana, which has two draw times a day).
   * Merging instead of replacing means a game only re-announces when its draw
   * date actually moves on.
   */
  const next: Record<string, string> = { ...prev };
  for (const [k, v] of Object.entries(ready)) next[k] = v;
  /*
   * Claim the change before sending it. Vercel runs several instances and every
   * open app polls, so two of them can notice the same new draw in the same
   * second and both send the reminder. Whoever writes the state first owns it;
   * the other sees the write fail and stays quiet.
   */
  const claimed = await firestorePutIfUnchanged("state/live", { json: JSON.stringify(next) }, prevDoc?.updateTime ?? null);
  if (!claimed) return { sent: 0, games: [], skipped: "another instance announced it" };
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
      const r = await sendToTokens(list, name, BODY[lang] || BODY.en, ROUTE_BY_GAME[cls] || "/");
      sent += r.sent;
      for (const id of r.dead) if (!dead.includes(id)) dead.push(id);
    }
  }
  for (const id of dead) await firestoreDelete("devices/" + id);
  return { sent, games, devices: devices.length };
}
