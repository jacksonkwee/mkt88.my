"use client";

import { useEffect } from "react";
import { nativeHttpGet } from "../../../../lib/native-http";
import { gameBySlug } from "./GameDefs";

/**
 * LiveResults - polls the original sources through the server proxy and
 * updates the rendered tables in place (no page reload):
 *  - live4dresult.net pages: synced cell-by-cell via data-id attributes
 *  - Perdana 4D: two draws/day from perdana4d.com
 *  - Lucky HariHari: two draws/day from api.hari4d.com
 */

// Poll faster during evening draw windows (6pm-10pm Malaysia time) so live
// draws appear one by one in near real time, slower the rest of the day.
function myHourNow(): number {
  try {
    return Number(
      new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kuala_Lumpur" }).format(new Date())
    );
  } catch {
    return new Date().getHours();
  }
}
/* Hard ceiling on any single source fetch. */
const FETCH_TIMEOUT_MS = 6000;
function nextInterval(): number {
  // 1.5 seconds while a draw is being published, twenty otherwise. This used to
  // be eight seconds and only covered the evening, so a number that was already
  // on the server could still wait up to eight seconds to appear. The server
  // hands out a copy no older than FRESH_MS in live-snapshot.ts, so this poll is
  // now the last remaining wait - which is why it was halved again.
  return inDrawWindow() ? 1500 : 20000;
}

/**
 * True around the times a draw is actually published. Everywhere else every
 * source already holds its final numbers for the day, so re-reading them every
 * few seconds only burns data - the page keeps updating from the pre-warmed
 * server snapshot instead.
 */
function inDrawWindow(now = new Date()): boolean {
  const d = new Date(now.getTime() + 8 * 60 * 60 * 1000); // Malaysia = UTC+8
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  return (mins >= 15 * 60 && mins <= 16 * 60 + 30)    // Cambodia 3:30pm draw
      || (mins >= 18 * 60 && mins <= 21 * 60);   // evening draws settle by 9pm   // evening draws
}

/* ------------------------------------------------------------------ *
 * Instant results: remember the last values we showed, restore them
 * immediately on the next visit, and never display the baked-in
 * (old) numbers while the fresh ones are being fetched.
 * ------------------------------------------------------------------ */
const SNAP_KEY = "mkt_live_snapshot_v3";
type Snap = { saved: number; cards: Record<string, Record<string, string>> };

/** Normalised page key used by refreshOnce / the snapshot cache. */
function syncPath(): string {
  let path = window.location.pathname;
  const gm = /^\/result\/([^/?#]+)/.exec(path);
  if (gm && gameBySlug[gm[1]]) path = "/";
  if (/^\/east\//.test(path)) path = "/sabah-sarawak-4d-results";
  if (path === "/sabah-sarawak-4d-results" && window.location.search.includes("op=")) path = "/";
  const pastM = /^\/past-results\/(\d{4}-\d{2}-\d{2})$/.exec(path);
  if (pastM && pastM[1] === dateStrNoPad(new Date())) path = "/";
  return path;
}

/** Live cards this page refreshes (so only those are blanked / cached). */
function syncedTableClasses(path: string): string[] {
  if (path === "/" || path === "/4dresults") {
    return ["table-1", "table-2", "table-3", "table-4", "table-5", "table-6", "table-7",
      "table-8", "table-9", "table-10", "table-11", "table-13", "table-14", "table-15", "table-16", "table-17", "table-18"];
  }
  if (path === "/singapore-4d-results") return ["table-11", "table-12"];
  if (path === "/lotto-4d" || path === "/cambodia-4d-results") return ["table-13", "table-14", "table-15", "table-16", "table-17", "table-18"];
  if (path === "/sabah-sarawak-4d-results") return ["table-8", "table-9", "table-10"];
  return [];
}

/** Store every value we are currently showing, so the next visit is instant. */
function collectSnapshot(): void {
  try {
    let prev: Snap | null = null;
    try { const raw = window.localStorage.getItem(SNAP_KEY); prev = raw ? (JSON.parse(raw) as Snap) : null; } catch { prev = null; }
    const cards: Record<string, Record<string, string>> = { ...(prev && prev.cards ? prev.cards : {}) };
    for (const card of Array.from(document.querySelectorAll(".card.outer-box[id]:not(.mkt-past)"))) {
      const id = card.getAttribute("id") || "";
      if (!id) continue;
      const vals: Record<string, string> = { ...(cards[id] || {}) };
      for (const el of Array.from(card.querySelectorAll("[data-id]"))) {
        const k = el.getAttribute("data-id") || "";
        const v = (el.textContent || "").trim();
        if (k && v && v !== "…") vals[k] = v;
      }
      if (Object.keys(vals).length) cards[id] = vals;
    }
    window.localStorage.setItem(SNAP_KEY, JSON.stringify({ saved: Date.now(), cards }));
  } catch { /* ignore */ }
}

/** Restore the last shown values before the network answers. */
function applySnapshot(): boolean {
  try {
    const raw = window.localStorage.getItem(SNAP_KEY);
    if (!raw) return false;
    const snap = JSON.parse(raw) as Snap;
    if (!snap || !snap.cards) return false;
    let applied = 0;
    for (const [id, vals] of Object.entries(snap.cards)) {
      const card = document.getElementById(id);
      if (!card) continue;
      for (const [k, v] of Object.entries(vals)) {
        const el = card.querySelector('[data-id="' + k + '"]');
        if (el && (el.textContent || "").trim() !== v) { el.textContent = v; el.classList.remove("live-pending"); applied++; }
      }
    }
    return applied > 0;
  } catch { return false; }
}

/** Blank the baked-in values of the cards that are about to be refreshed, so an
 *  old draw date/number is never shown while the fresh result is loading. */
function maskStaleCards(classes: string[]): void {
  for (const cls of classes) {
    for (const card of Array.from(document.querySelectorAll(".card.outer-box." + cls + ":not(.mkt-past)"))) {
      for (const el of Array.from(card.querySelectorAll("[data-id], .lottery-prize-number, .lottery-number"))) {
        const k = el.getAttribute("data-id") || "";
        const v = (el.textContent || "").trim();
        if (k === "date" || k === "draw_no" || /^\d{3,6}$/.test(v)) {
          if (!el.hasAttribute("data-mkt-orig")) el.setAttribute("data-mkt-orig", v);
          el.textContent = "…";
        }
      }
    }
  }
}

/** Safety net: any card a source could not refresh gets its original text back,
 *  so nothing is ever left blank. */
function restoreUnfilled(): void {
  for (const el of Array.from(document.querySelectorAll("[data-mkt-orig]"))) {
    if ((el.textContent || "").trim() === "…") el.textContent = el.getAttribute("data-mkt-orig") || "";
    el.classList.remove("live-pending");
    el.removeAttribute("data-mkt-orig");
  }
  // Any cell a source never touched simply shows its built-in value again.
  for (const el of Array.from(document.querySelectorAll("[data-id].live-pending"))) {
    el.classList.remove("live-pending");
  }
}

type PrizeSet = { prize: string[]; special: string[]; cons: string[]; date?: string; drawNo?: string; from?: string[] };

function isDash(v: string) {
  const t = (v || "").trim();
  return /^----+$/.test(t) || t === "";
}

/**
 * A draw is usable as soon as ANY number of it is published.
 *
 * The official feeds reveal a draw number by number (special numbers first,
 * then 1st/2nd/3rd). Requiring the 1st prize - as this file used to - pushed a
 * live draw back to yesterday's result. Never test only `prize` again: use
 * this helper for every "is there a result?" decision.
 */
function setHasAny(s: PrizeSet | null | undefined): s is PrizeSet {
  if (!s) return false;
  const all = [...(s.prize || []), ...(s.special || []), ...(s.cons || [])];
  return all.some((v) => !isDash(v));
}

/**
 * Hosts that refuse our Render server but answer browsers directly. HariHari's
 * API 403s every request from the server's IP, which stopped its results dead,
 * so ask the phone first and keep the server proxy as the fallback.
 */
const DIRECT_HOSTS = ["api.hari4d.com"];
/** Read through the app itself: these refuse every browser and our server. */
const NATIVE_HOSTS = ["www.perdana4d.com", "perdana4d.com"];

async function fetchText(url: string): Promise<string | null> {
  try {
    if (NATIVE_HOSTS.includes(new URL(url).hostname)) {
      const viaApp = await nativeHttpGet(url);
      if (viaApp) return viaApp;
    }
  } catch { /* fall through to the usual routes */ }
  try {
    try {
      if (DIRECT_HOSTS.includes(new URL(url).hostname)) {
        const direct = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (direct.ok) return await direct.text();
      }
    } catch { /* CORS or offline - fall back to the server proxy */ }
    // Never wait indefinitely on a source. gdlotto in particular can hang, and
    // an unbounded fetch here blocked the whole refresh loop - which stopped
    // every one of the 11 games updating, not just Grand Dragon.
    const res = await fetch("/api/live?u=" + encodeURIComponent(url), { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchDoc(url: string): Promise<Document | null> {
  const text = await fetchText(url);
  if (!text) return null;
  try {
    return new DOMParser().parseFromString(text, "text/html");
  } catch {
    return null;
  }
}

/** Sort date labels such as 12-09-2026 or 12-09-2026 (Sat). */
function dateScore(label?: string): number {
  const m = /(\d{2})-(\d{2})-(\d{4})/.exec(label || "");
  return m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : 0;
}
function weekdayOf(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  const parts = iso.split("-");
  const wk = d.toLocaleDateString("en-US", { weekday: "short" });
  return `${parts[2]}-${parts[1]}-${parts[0]} (${wk})`;
}

function setText(el: Element | null, v: string) {
  if (!el) return;
  // A 6D sub-prize (2nd..5th) must never be blanked by a source that does not
  // carry it - otherwise the good value is wiped right after it appears.
  const id = el.getAttribute("data-id") || "";
  if (/^six_/.test(id) && /^----+$/.test(v.trim())) return;
  if (el.textContent !== v) el.textContent = v;
  el.classList.remove("live-pending");
}

/**
 * Find a card cell by the name the snapshot uses.
 *
 * Sabah 88's grid is the odd one out: its cells are called
 * special_number_N / consolation_number_N while every other card - and the
 * server snapshot - uses special-N / consolation-N. The fast path looked up
 * special-1, found nothing on that card, and quietly wrote nothing, so Sabah 88
 * was only ever updated by the mirror sweep that runs once every 45 seconds.
 * That is why its live numbers lagged the other apps by up to three quarters of
 * a minute (reported 3 Oct 2026).
 */
function cellFor(card: Element, id: string): Element | null {
  const direct = card.querySelector('[data-id="' + id + '"]');
  if (direct) return direct;
  const m = /^(special|consolation)-(\d+)$/.exec(id);
  if (!m) return null;
  return card.querySelector('[data-id="' + m[1] + '_number_' + m[2] + '"]');
}

/**
 * A repeat inside the same grid is never a real result.
 *
 * The server clears a repeat before it hands the snapshot over, but it is not
 * the only writer: the mirror sweep writes these cards by position, and a blank
 * cell in the mirror's own grid slides every later number one column left - the
 * documented cause of 9184 appearing twice on Sports Toto and of Grand Dragon's
 * cell 13 holding cell 12's number (reported 4 Oct 2026). The "never blank a
 * known number" rule below then keeps the repeat on screen, because the
 * server's blank is one of the blanks that rule refuses to write.
 *
 * So the grid is tidied on the card itself, after every write: the later copy
 * of a repeat is blanked, so no published number is ever lost. A cell that
 * holds something which is not a number at all - Sports Toto prints "****" in
 * its empty special cells - is blanked too, matching what the card should show.
 * Only the mirror-fed cards are touched, because a sliding mirror grid is what
 * puts a repeat or a marker in the wrong cell, and an operator's own board must
 * never be rewritten.
 */
const MIRROR_ONLY_CLASSES = ["table-2", "table-3", "table-6", "table-7", "table-13"];

function cleanGrid(card: Element): void {
  for (const [prefix, count] of [["special-", 15], ["consolation-", 10]] as [string, number][]) {
    const seen = new Set<string>();
    for (let i = 1; i <= count; i++) {
      const el = cellFor(card, prefix + i);
      if (!el) continue;
      const v = (el.textContent || "").trim();
      if (!v || /^----+$/.test(v)) continue;
      if (!/^\d{3,4}$/.test(v)) { el.textContent = "----"; continue; }
      if (seen.has(v)) el.textContent = "----";
      else seen.add(v);
    }
  }
}

/** If a card is labelled with today's date but has no Draw No yet, the draw has
 *  not happened - clear the stale numbers so nothing shows before it opens. */
function clearIfNoDraw(target: Element) {
  const dateEl = target.querySelector('[data-id="date"]');
  const dnEl = target.querySelector('[data-id="draw_no"]');
  if (!dateEl || !dnEl) return;
  const todayLbl = weekdayOf(dateStrNoPad(new Date()));
  if ((dateEl.textContent || "").trim() !== todayLbl) return;
  const dnTxt = (dnEl.textContent || "").trim();
  if (/\d/.test(dnTxt)) return; // draw number present = draw published
  const numEls = [...target.querySelectorAll('[data-id^="number_"]')];
  for (const el of numEls) if (el.textContent && el.textContent.trim() !== "") el.textContent = "";
}

/**
 * `clearGaps` lists the card classes this mirror is the ONLY writer of. Their
 * source gaps mean "not published yet", so they must be cleared - otherwise a
 * draw rollover leaves the previous draw's numbers sitting in them. Every other
 * card is also filled by the snapshot, and blanking its gaps made the two
 * writers fight, which slid the numbers around.
 */
async function syncLiveTable(url: string, tableClasses: string[], clearGaps: string[] = []) {
  const doc = await fetchDoc(url);
  if (!doc) return;
  for (const cls of tableClasses) {
    const srcCard = doc.querySelector(".card.outer-box." + cls + ":not(.mkt-past)");
    const targets = [...document.querySelectorAll(".card.outer-box." + cls + ":not(.mkt-past)")];
    if (!srcCard || targets.length === 0) continue;
    for (const target of targets) {
      // Mirror the source exactly (both directions). When the official draw is
      // cleared for the new draw date the numbers are wiped to "----" first;
      // when the draw is released the numbers are revealed one by one.
      const pending = new Map<string, string>();
      let hasClear = false;
      const els = [...target.querySelectorAll("[data-id]")];
      for (const tgtEl of els) {
        const id = tgtEl.getAttribute("data-id") || "";
        if (!id) continue;
        const srcEl = srcCard.querySelector('[data-id="' + id + '"]');
        if (!srcEl) continue;
        const v = (srcEl.textContent || "").trim();
        const cur = (tgtEl.textContent || "").trim();
        if (v === cur) continue;
        // An empty cell on the source page carries no information - the source
        // leaves gaps that the snapshot fills by data-id. Mirroring those gaps
        // blanked good numbers and made the snapshot write them back, which is
        // what slid the Special numbers back and forth roughly once a second.
        if (v === "") {
          if (clearGaps.includes(cls) && !isDash(cur) && /lottery-prize-number|lottery-number/.test(tgtEl.className)) {
            pending.set(id, "----");
            hasClear = true;
          }
          continue;
        }
        // Special / Consolation are drawn grids where a number never repeats,
        // so a value already shown in a sibling cell means the source page is
        // laid out one cell off and this write would slide the whole grid.
        // Only those two grids may be checked this way. Every other cell must
        // be written as-is - the jackpot cards hold single DIGITS
        // (8 7 8 1 1 5 + 1 0), which repeat by nature, and skipping a repeated
        // digit corrupts the jackpot number.
        if (/^(special|consolation)-/.test(id) && !isDash(v)
            && els.some((o) => o !== tgtEl && (o.textContent || "").trim() === v)) continue;
        pending.set(id, v);
        if (isDash(v) && !isDash(cur)) hasClear = true;
      }
      if (pending.size === 0) continue;
      if (hasClear) {
        for (const [id, v] of pending) {
          const el = target.querySelector('[data-id="' + id + '"]');
          setText(el, v);
        }
        flash(target);
        clearIfNoDraw(target);
        continue;
      }
      const changed: { el: Element; v: string }[] = [];
      for (const tgtEl of els) {
        const id = tgtEl.getAttribute("data-id") || "";
        if (!id || !pending.has(id)) continue;
        changed.push({ el: tgtEl, v: pending.get(id)! });
      }
      changed.forEach((c, i) => {
        window.setTimeout(() => setText(c.el, c.v), 140 * i);
      });
      window.setTimeout(() => flash(target), 140 * changed.length);
      clearIfNoDraw(target);
    }
  }
}

function flash(card: Element) {
  card.classList.add("live-flash");
  setTimeout(() => card.classList.remove("live-flash"), 900);
}

/**
 * The draw number last written to each card.
 *
 * HariHari (and any game with two draws in a day) publishes a second draw under
 * the SAME date, so a date change alone cannot tell us a new draw has started -
 * and without that, the cells the source has not revealed yet kept the previous
 * draw's numbers, leaving a mixed board (reported 6 Oct 2026: special H showed
 * 3503 from the past draw while the live one had 4921).
 */
const shownDrawNo = new WeakMap<Element, string>();

function applySet(card: Element, s: PrizeSet) {
  if (!s || !s.prize || s.prize.length === 0) return;
  const hasAny = (arr?: string[]) => !!arr && arr.some((v) => !isDash(v));
  const pending: { el: Element; v: string }[] = [];
  // A brand-new draw (different date) shows every prize as published, including
  // the ones the official site has not released yet ("----"), so an in-progress
  // draw never keeps the previous day's numbers on screen.
  const dateEl = card.querySelector('[data-id="date"]');
  const curDate = dateEl ? (dateEl.textContent || "").trim() : "";
  // A source that is one draw behind must never drag the card back to it - that
  // is what made a finished card flicker between today's and yesterday's result.
  const inDay = dateScore(s.date), curDay = dateScore(curDate);
  if (inDay && curDay && inDay < curDay) return;
  const drawNoEl = card.querySelector('[data-id="draw_no"]');
  const curDrawNo = ((drawNoEl ? drawNoEl.textContent : "") || "").trim() || shownDrawNo.get(card) || "";
  if (s.drawNo) shownDrawNo.set(card, s.drawNo);
  // A new draw is a new date OR a new draw number. Either way the cells the
  // source has not revealed yet are written as "----" instead of keeping the
  // previous draw's numbers.
  const newDraw = (!!s.date && s.date !== curDate) || (!!s.drawNo && !!curDrawNo && s.drawNo !== curDrawNo);
  /*
   * An empty board is normally ignored, so a source hiccup cannot wipe a good
   * result. But when the draw number has moved on, the card MUST move with it -
   * even to an empty board, because that is the new draw starting. Leaving the
   * old numbers there is what showed a past number beside a live prize: the
   * 7:30pm HariHari card kept yesterday's 5202 in cell H while the new draw's
   * 1st prize was already lettered H (reported 6 Oct 2026).
   */
  if (!hasAny(s.prize) && !hasAny(s.special) && !hasAny(s.cons) && !newDraw) return;
  // force = true: the operator's board is taken exactly as published, blanks
  // included. It is the same source the official site shows, and skipping a
  // blank is what left a past draw's number in a cell the operator had cleared.
  const stage = (el: Element | null, v: string | undefined, force = false) => {
    if (!el || v === undefined) return;
    const val = v.trim();
    const cur = (el.textContent || "").trim();
    if (cur === val) return;
    if (isDash(val) && !force && !newDraw) return;
    pending.push({ el, v: val });
  };
  /*
   * Letters in front of the numbers, exactly as the operator prints them: the
   * prize rows carry the special each prize came from, and the Special column
   * is labelled A to M. They are stamped on the cell and drawn by CSS so the
   * cell's own text stays just the number - anything reading the numbers (the
   * favourite highlight, the number-history links) keeps working.
   */
  const tables = [...card.querySelectorAll("table")];
  const prizeRows = tables[0] ? [...tables[0].querySelectorAll("tr")] : [];
  (s.from || []).forEach((L, i) => {
    const row = prizeRows[i];
    const cell = row ? row.querySelector("td.lottery-prize-number") : null;
    if (!cell) return;
    const letter = (L || "").trim().toUpperCase();
    const num = String(s.prize[i] ?? "").trim();
    // The operator knows which special a prize came from before it prints the
    // number. A letter with no number reads as a mistake, so it waits.
    if (/^[A-W]$/.test(letter) && /^\d{3,6}$/.test(num)) cell.setAttribute("data-letter", letter);
    else cell.removeAttribute("data-letter");
  });
  s.prize.forEach((v, i) => {
    const row = prizeRows[i];
    stage(row ? row.querySelector("td.lottery-prize-number") : null, v, true);
  });
  const specialCells = tables[1] ? [...tables[1].querySelectorAll("td.lottery-number")] : [];
  specialCells.slice(0, 13).forEach((cell, i) => {
    if (cell && !cell.hasAttribute("data-letter")) cell.setAttribute("data-letter", LETTERS[i]);
  });
  s.special.forEach((v, i) => stage(specialCells[i], v, true));
  if (s.special.length > 0 && specialCells.length > s.special.length) {
    for (let i = s.special.length; i < specialCells.length; i++) {
      if (specialCells[i]) (specialCells[i] as HTMLElement).innerHTML = "&nbsp;";
    }
  }
  const consCells = tables[2] ? [...tables[2].querySelectorAll("td.lottery-number")] : [];
  s.cons.forEach((v, i) => stage(consCells[i], v, true));
  if (s.date) {
    const dt = card.querySelector('[data-id="date"]');
    if (dt && dt.textContent !== s.date) pending.unshift({ el: dt, v: s.date });
  }
  if (s.drawNo) {
    const dn = card.querySelector('[data-id="draw_no"]');
    if (dn && dn.textContent !== s.drawNo) pending.push({ el: dn, v: s.drawNo });
  }
  if (pending.length === 0) return;
  // Write the whole draw in one pass. The old reveal (90ms per cell) made a
  // full HariHari card take over two seconds to fill in, number by number.
  for (const c of pending) setText(c.el, c.v);
  flash(card);
}

/**
 * The jackpot letter is the special the jackpot number fell on, so it is read
 * back off the card itself. The operator has no letter field for it in the
 * feed, but the numbers it sends are the same ones already printed.
 */
function showJackpotLetter(cardId: string, nums: string) {
  const wanted = (nums || "").split(/[^0-9]+/).filter((v) => /^\d{4}$/.test(v));
  if (!wanted.length) return;
  applyToCardsById(cardId, (card) => {
    const letters: string[] = [];
    card.querySelectorAll("td.lottery-number[data-letter]").forEach((el) => {
      const v = (el.textContent || "").trim();
      const L = el.getAttribute("data-letter") || "";
      if (wanted.includes(v) && L && !letters.includes(L)) letters.push(L);
    });
    const cell = jackpotLetterCell(card);
    if (cell) cell.textContent = letters.join(" · ") || "----";
  });
}

/** Add the "Jackpot Letter 积宝字母" row to a card the first time it is needed. */
function jackpotLetterCell(card: Element): Element | null {
  const existing = card.querySelector('[data-id="jp_letter"]');
  if (existing) return existing;
  const unitsCell = card.querySelector('[data-id="jp_units"]');
  const tr = unitsCell ? unitsCell.closest("tr") : null;
  if (!tr || !tr.parentElement) return null;
  const row = document.createElement("tr");
  const label = document.createElement("td");
  label.className = "lottery-prize-title text-center";
  label.setAttribute("width", "45%");
  label.textContent = "Jackpot Letter 积宝字母";
  const value = document.createElement("td");
  value.className = "lottery-prize-number border text-center";
  value.setAttribute("data-id", "jp_letter");
  value.setAttribute("width", "55%");
  value.textContent = "----";
  row.appendChild(label);
  row.appendChild(value);
  tr.parentElement.insertBefore(row, tr);
  return value;
}

/**
 * True while any card on the page still has something to come.
 *
 * Da Ma Cai and Cash Sweep put their 1st/2nd/3rd prizes up first and fill the
 * specials and consolations afterwards, so those two are only finished when the
 * whole grid is in. Every other game finishes with its prizes.
 */
const PRIZES_FIRST_CARDS = ["table-4", "table-5", "table-9"];
function anyLiveCard(): boolean {
  for (const card of Array.from(document.querySelectorAll(".card.outer-box:not(.mkt-past)"))) {
    // Cards with no prize cells at all (the 6D and jackpot cards) can never
    // "finish" by this rule, so they must not hold the page on the fast beat
    // all day - that was making the app poll every second around the clock.
    if (!card.querySelector('[data-id="first_prize"]')) continue;
    const prizes = ["first_prize", "second_prize", "third_prize"].every((id) => {
      const cell = card.querySelector('[data-id="' + id + '"]');
      return !!cell && /^\d{3,6}$/.test((cell.textContent || "").trim());
    });
    if (!prizes) return true;
    if (!PRIZES_FIRST_CARDS.some((c) => card.classList.contains(c))) continue;
    for (const prefix of ["special-", "consolation-"]) {
      for (let i = 1; i <= 10; i++) {
        const cell = card.querySelector('[data-id="' + prefix + i + '"]');
        if (cell && !/^\d{3,4}$/.test((cell.textContent || "").trim())) return true;
      }
    }
  }
  return false;
}

/** Parse perdana4d.com innerText into { time -> set }. */
function parsePerdana(doc: Document): Record<string, PrizeSet> {
  const lines = (doc.body ? doc.body.innerText : "").split("\n").map((l) => l.trim());
  const markers: number[] = [];
  lines.forEach((l, i) => {
    if (/^\d{8}4D$/.test(l) || /^\d{12}4D$/.test(l)) markers.push(i);
  });
  const out: Record<string, PrizeSet> = {};
  for (let mi = 0; mi < markers.length; mi++) {
    const start = markers[mi];
    const end = mi + 1 < markers.length ? markers[mi + 1] : lines.length;
    const block = lines.slice(start, end);
    const dateM = /^(\d{4})(\d{2})(\d{2})/.exec(block[0] || "");
    const iso = dateM ? `${dateM[1]}-${dateM[2]}-${dateM[3]}` : undefined;
    const timeLine = block.slice(1, 8).find((l) => /^(\d{1,2}:\d{2})$/.test(l));
    const time = timeLine || null;
    if (!time) continue;
    const pIdx = block.findIndex((l) => /^3rd Prize$/i.test(l));
    const sIdx = block.findIndex((l) => l.toLowerCase() === "special");
    const cIdx = block.findIndex((l) => l.toLowerCase() === "consolation");
    const endIdx = block.findIndex((l) => /^(2D|3D|6D) Results$/i.test(l));
    const prize: string[] = [];
    if (pIdx >= 0 && sIdx > pIdx) {
      for (let i = pIdx + 1; i < sIdx && prize.length < 3; i++) {
        const l = block[i];
        if (!l) continue;
        const cmb = /^\([A-Z]\)\s*(----|\d{4})$/.exec(l);
        if (cmb) { prize.push(cmb[1]); continue; }
        if (/^----$/.test(l)) { prize.push(l); continue; }
        const letterOnly = /^\([A-Z]\)$/.exec(l);
        if (letterOnly && i + 1 < sIdx && /^(----|\d{4})$/.test(block[i + 1])) { prize.push(block[i + 1]); i++; }
      }
      while (prize.length < 3) prize.push("----");
    }
    const grab = (from: number, to: number): string[] => {
      const vals: string[] = [];
      for (let i = from; i < to; i++) {
        const l = block[i];
        if (!l) continue;
        const cmb = /^\([A-Z]\)\s*(----|\d{4})$/.exec(l);
        if (cmb) { vals.push(cmb[1]); continue; }
        const letterOnly = /^\([A-Z]\)$/.exec(l);
        if (letterOnly && i + 1 < to && /^(----|\d{4})$/.test(block[i + 1])) {
          vals.push(block[i + 1]);
          i++;
        }
      }
      return vals;
    };
    const special = sIdx >= 0 ? grab(sIdx + 1, cIdx > sIdx ? cIdx : endIdx > sIdx ? endIdx : lines.length) : [];
    const cons = cIdx >= 0 ? grab(cIdx + 1, endIdx > cIdx ? endIdx : lines.length) : [];
    out[time] = { prize, special, cons, date: iso ? weekdayOf(iso) : undefined };
  }
  return out;
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
const CONS_LETTERS = ["N", "O", "P", "Q", "R", "S", "T", "U", "V", "W"];

/** Parse a hari4d.com JSON draw payload. */
function hariSetFromJson(j: any): PrizeSet | null {
  // A draw that exists but has published nothing yet still has to move the card\n  // on: requiring a 1st prize kept the previous draw on screen while the new one\n  // started (reported 6 Oct 2026). id 0 means there is no such draw yet.\n  if (!j || !(Number(j.id) > 0)) return null;
  const special = LETTERS.map((L) => String(j["prize" + L] ?? "----"));
  const cons = CONS_LETTERS.map((L) => String(j["prize" + L] ?? "----"));
  const iso = typeof j.drawDate === "string" ? j.drawDate.slice(0, 10) : undefined;
  return {
    prize: [j.prize1, j.prize2, j.prize3].map((x) => String(x)),
    special,
    cons,
    drawNo: j.id != null ? String(j.id) : undefined,
    date: iso ? weekdayOf(iso) : undefined,
    // The operator prints which special each prize came from: prize1From=H.
    from: [j.prize1From, j.prize2From, j.prize3From].map((v) => String(v ?? "").trim()),
  };
}

function dateStrNoPad(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return parts; // YYYY-MM-DD
}

type SixSet = { main: string; date?: string; subs?: Record<string, string> };

function applyToCardsById(cardId: string, apply: (card: Element) => void) {
  const cards = [...document.querySelectorAll('[id="' + cardId + '"]')];
  for (const card of cards) apply(card);
}

function applySixValues(cardId: string, s: SixSet | null) {
  if (!s) return;
  applyToCardsById(cardId, (card) => {
    const pending = new Map<string, string>();
    const stage = (id: string, v: string | undefined) => {
      if (v === undefined) return;
      const el = card.querySelector('[data-id="' + id + '"]');
      if (!el) return;
      if ((el.textContent || "").trim() === v.trim()) return;
      pending.set(id, v.trim());
    };
    stage("six_main", s.main);
    if (s.date) stage("date", s.date);
    // Never blank a 6D sub-prize that we do not have a real value for.
    if (s.subs) for (const [k, v] of Object.entries(s.subs)) { if (!isDash(v)) stage(k, v); }
    if (pending.size === 0) return;
    // Write the whole card in one pass; the old reveal was 140ms per field.
    for (const [id, v] of pending) setText(card.querySelector('[data-id="' + id + '"]'), v);
    flash(card);
  });
}

function applyIdValues(cardId: string, vals: Record<string, string>) {
  applyToCardsById(cardId, (card) => {
    const pending: { el: Element; v: string }[] = [];
    for (const [id, v] of Object.entries(vals)) {
      const el = card.querySelector('[data-id="' + id + '"]');
      if (!el) continue;
      if ((el.textContent || "").trim() === v.trim()) continue;
      pending.push({ el, v: v.trim() });
    }
    if (pending.length === 0) return;
    // Write the whole card in one pass; the old reveal was 140ms per field.
    for (const c of pending) setText(c.el, c.v);
    flash(card);
  });
}

/** SixD values included in the same hari4d.com draw payload. */
function sixFromHariJson(j: any): SixSet | null {
  if (!j) return null;
  const main = String(j.prize6D ?? "----");
  const iso = typeof j.drawDate === "string" ? j.drawDate.slice(0, 10) : undefined;
  const subs: Record<string, string> = {};
  for (const k of ["2A", "2B", "3A", "3B", "4A", "4B", "5A", "5B"]) {
    subs["six_" + k.toLowerCase()] = String(j["prize6D_" + k] ?? "----");
  }
  return { main, subs, date: iso ? weekdayOf(iso) : undefined };
}

/** Nine Lotto 6D is built from its 4D 1st/2nd/3rd prizes (official rule). */
function nineSixFromPrizes(prize: string[]): SixSet | null {
  const p = [prize[0] || "----", prize[1] || "----", prize[2] || "----"];
  if (!p.every((x) => /^\d{4}$/.test(x))) return null;
  const main = p[0][0] + p[1][0] + p[2][0] + p[0][3] + p[1][3] + p[2][3];
  return {
    main,
    subs: {
      six_2a: main.slice(0, 5), six_2b: main.slice(1),
      six_3a: main.slice(0, 4), six_3b: main.slice(2),
      six_4a: main.slice(0, 3), six_4b: main.slice(3),
      six_5a: main.slice(0, 2), six_5b: main.slice(4),
    },
  };
}

function nineJpFromDoc(doc: Document): { pool?: string; rows?: Record<string, string> } | null {
  const poolEl = doc.querySelector("#sjp");
  const pool = poolEl ? (poolEl.textContent || "").trim() : undefined;
  const rows: Record<string, string> = {};
  const trs = doc.querySelectorAll(".result-numbersjp");
  for (const tr of trs) {
    const lbl = tr.querySelector(".char1");
    const label = lbl ? (lbl.textContent || "").trim() : "";
    const nums = [...tr.querySelectorAll(".result-sjp-prize")].map((n) => (n.textContent || "").trim());
    const key = "n9_sj_" + label.replace(/\s*prize$/i, "").trim().toLowerCase();
    if (nums.length) rows[key] = nums.join(" + ");
  }
  return { pool, rows };
}

type GdInfo = { six: SixSet; jp4: Record<string, string>; jp7: Record<string, string> };

function parseNineDoc(doc: Document): { prize: string[]; special: string[]; cons: string[]; drawNo?: string; dateIso?: string } | null {
  const value = (id: string): string => {
    const el = doc.querySelector("#" + id);
    const v = el ? (el.textContent || "").trim() : "";
    return /^\d{4}$/.test(v) ? v : "----";
  };
  const label = doc.querySelector(".result-date-label");
  const drawNo = label && label.nextElementSibling ? (label.nextElementSibling.textContent || "").trim() : undefined;
  const dateEl = doc.querySelector("#inputDate");
  const dateIso = dateEl ? (dateEl.getAttribute("placeholder") || "").trim() : "";
  const prize = ["n1", "n2", "n3"].map(value);
  const special = [..."ABCDEFGHIJKLM"].map((letter) => value("n" + letter));
  const cons = [..."NOPQRSTUVW"].map((letter) => value("n" + letter));
  return {
    prize,
    special: special.slice(0, 13),
    cons: cons.slice(0, 10),
    drawNo: drawNo && /\d+\/\d{4}/.test(drawNo) ? drawNo : undefined,
    dateIso: /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? dateIso : undefined,
  };
}

/** Grand Dragon 6D + Jackpots - today and yesterday are compared. The official
 *  dated feed returns the previous draw again until today's is published, so a
 *  result only counts as today's when the page differs from yesterday's.
 *  Otherwise nothing is written: the cards keep the live draw date from the 4D
 *  feed and the numbers stay blank ("----") instead of showing the previous
 *  draw under today's date. */
async function gdInfo(): Promise<GdInfo | null> {
  const cand: GdInfo[] = [];
  for (let off = 0; off <= 1; off++) {
    const iso = dateStrNoPad(new Date(Date.now() - off * 86400000));
    const [y, mo, dd] = iso.split("-");
    const doc = await fetchDoc(
      "https://gdlotto.net/results/ajax/_result.aspx?past=1&v=1&d=" + mo + "/" + dd + "/" + y
    );
    if (!doc || !doc.body) continue;
    const text = (doc.body.innerText || "").replace(/\s+/g, " ");
    const date = weekdayOf(iso);
    const m = /6D\s*1st\s*Prize\s+([0-9](?:\s*[0-9]){5})/.exec(text);
    const jp4: Record<string, string> = {};
    const pool4 = doc.getElementById("4d_jpool");
    if (pool4) jp4.jp4_pool = (pool4.textContent || "").trim();
    const letter4 = doc.getElementById("4d_jpalphnum");
    if (letter4 && (letter4.textContent || "").trim()) jp4.jp4_letter = (letter4.textContent || "").trim();
    const units4 = doc.getElementById("4d_jptotalunit");
    if (units4 && (units4.textContent || "").trim()) jp4.jp4_units = (units4.textContent || "").trim();
    const jp7: Record<string, string> = {};
    const pool7 = doc.getElementsByClassName("7d_JPool")[0];
    if (pool7) jp7.jp7_pool = (pool7.textContent || "").trim();
    const resBlocks = [...doc.querySelectorAll(".dragonjp .djp-res")];
    if (resBlocks.length >= 1) {
      const grand = [...resBlocks[0].querySelectorAll("span")].map((sp) => sp.textContent.trim()).join("");
      const gd7 = grand.replace(/[^0-9]/g, "");
      if (/^\d{7}$/.test(gd7)) jp7.jp7_grand = gd7.slice(0, 6) + " + " + gd7[6];
    }
    // The operator prints the special each prize came from, in brackets:
    // "1st Prize ( H ) 4921".
    const from4: Record<string, string> = {};
    for (const [domId, key] of [["1stAlph", "p1"], ["2ndAlph", "p2"], ["3rdAlph", "p3"]] as [string, string][]) {
      const el = doc.getElementById(domId);
      const v = el ? (el.textContent || "").trim().toUpperCase() : "";
      if (/^[A-M]$/.test(v)) from4[key] = v;
    }
    const main = m ? m[1].replace(/\s+/g, "") : "----";
    const hasDraw = /^\d{6}$/.test(main) || (jp7.jp7_grand || "").includes(" + ");
    if (!hasDraw) continue;
    const six: SixSet = /^\d{6}$/.test(main)
      ? {
          main,
          date,
          subs: {
            six_2a: main.slice(0, 5), six_2b: main.slice(1),
            six_3a: main.slice(0, 4), six_3b: main.slice(2),
            six_4a: main.slice(0, 3), six_4b: main.slice(3),
            six_5a: main.slice(0, 2), six_5b: main.slice(4),
          },
        }
      : { main: "----", date };
    cand.push({ six, jp4: { ...jp4, ...from4 }, jp7 });
  }
  if (!cand.length) return null;
  /*
   * The jackpot letter moves on one step every draw: A -> B -> ... -> M -> A.
   * The official board puts the letter up LAST, so while today's is still
   * missing it is worked out from yesterday's, which is the rule the operator
   * follows (confirmed 6 Oct 2026).
   */
  if (cand.length >= 2) {
    const seen = /[A-M]/.exec(String(cand[0].jp4.jp4_letter || "").toUpperCase());
    const prev = /[A-M]/.exec(String(cand[1].jp4.jp4_letter || "").toUpperCase());
    if (!seen && prev) {
      const ABC = "ABCDEFGHIJKLM";
      cand[0].jp4.jp4_letter = ABC[(ABC.indexOf(prev[0]) + 1) % 13];
    }
  }
  if (cand.length >= 2) {
    // gdlotto answers today's URL with yesterday's draw until today's is out.
    // A difference anywhere (6D, jackpot pool, jackpot number) means a new draw
    // has started and must be shown even while its 6D is still pending. While
    // the two pages match, the most recent completed draw IS yesterday's, so
    // show that one: it carries yesterday's own date, so the date and the
    // numbers always agree and the card is never left blank.
    const a = cand[0];
    const b = cand[1];
    const sameDraw = a.six.main === b.six.main
      && (a.jp7.jp7_grand || "") === (b.jp7.jp7_grand || "")
      && (a.jp7.jp7_pool || "") === (b.jp7.jp7_pool || "");
    if (sameDraw) return cand[1];
  }
  return cand[0];
}

function clearCardNumbers(card: Element) {
  for (const el of card.querySelectorAll("td.lottery-prize-number, td.lottery-number")) {
    if ((el.textContent || "") !== "") { el.textContent = "----"; el.classList.remove("live-pending"); }
  }
}

/**
 * The operator updates the 4D jackpot letter LAST.
 *
 * While a draw is being revealed the result page still carries the PREVIOUS
 * draw's letter and number, and writing it straight onto the card is what put
 * "L 3823" under today's 02-10-2026 Grand Dragon 4D result all evening - only
 * corrected to "M 6210" once the draw finished. Measured on 2 Oct 2026.
 *
 * The jackpot letter's number is always one of the current draw's thirteen
 * special numbers, so it can be checked against the card itself: if the number
 * is not on the board, the value belongs to an older draw and is written as
 * blank instead. A short "----" is right; yesterday's letter under today's date
 * is not. The next sweep fills in the real letter as soon as it is published.
 */
function liveJackpotLetter(cardId: string, jp4: Record<string, string>): Record<string, string> {
  const raw = jp4.jp4_letter;
  if (!raw) return jp4;
  // "M: 6210" / "M 6210" / "M6210" all reduce to the four digits.
  const num = raw.replace(/^[A-Za-z]\s*:?\s*/, "").replace(/[^0-9]/g, "").slice(0, 4);
  if (!/^\d{4}$/.test(num)) {
    // A letter on its own is the next one in the sequence, worked out from
    // yesterday's draw - not a stale number - so it is allowed through.
    if (/^[A-M]$/i.test(String(raw).trim())) return jp4;
    return { ...jp4, jp4_letter: "----" };
  }
  const card = document.getElementById(cardId);
  if (!card) return jp4;
  for (let i = 1; i <= 13; i++) {
    const el = card.querySelector('[data-id="special-' + i + '"]');
    const v = el ? (el.textContent || "").trim() : "";
    if (/^\d{4}$/.test(v) && v === num) return jp4;
  }
  return { ...jp4, jp4_letter: "----" };
}

async function updateGdNineCards() {
  // Grand Dragon 6D + 4D jackpot + 6+1D jackpot (official gdlotto endpoint)
  try {
    const gd = await gdInfo();
    if (gd) {
      applySixValues("table-14-2026-09-06-6d", gd.six);
      // The jackpot card is its own card - keep its date in step too.
      if (gd.six.date) applyIdValues("table-14-2026-09-06-6d-jp", { date: gd.six.date });
      applyIdValues("table-13-2026-09-06", liveJackpotLetter("table-13-2026-09-06", gd.jp4));
      for (const [key, id] of [["p1", "first_prize"], ["p2", "second_prize"], ["p3", "third_prize"]] as [string, string][]) {
        const L = gd.jp4[key];
        applyToCardsById("table-13-2026-09-06", (card) => {
          const cell = card.querySelector('[data-id="' + id + '"]');
          if (!cell) return;
          const num = (cell.textContent || "").trim();
          // The official board publishes the letter before the number; showing
          // it on its own looks like a result that is not there yet.
          if (L && /^[A-M]$/.test(L) && /^\d{4}$/.test(num)) cell.setAttribute("data-letter", L);
          else cell.removeAttribute("data-letter");
        });
      }
      // The 6+1D jackpot is written only from the server snapshot, which knows
      // whether today's jackpot has actually been settled. Writing it here too
      // showed the previous draw's pool under today's date.
    }
  } catch {
    // ignore
  }
  // Nine Lotto - today and yesterday are compared. The official dated page
  // returns yesterday's numbers again when today's draw is not published yet,
  // so we only label results "today" when today's six-digit draw differs from
  // yesterday's (i.e. a genuinely new draw). Otherwise yesterday's date is shown.
  try {
    const nineCards = [...document.querySelectorAll(".card.outer-box.table-17:not(.mkt-past)")];
    const cand: { dateLbl: string; ns: ReturnType<typeof parseNineDoc>; six: SixSet | null; jp9: ReturnType<typeof nineJpFromDoc> }[] = [];
    for (let off = 0; off <= 1; off++) {
      const d = dateStrNoPad(new Date(Date.now() - off * 86400000));
      const [y, m, dd] = d.split("-");
      const nd = await fetchDoc("https://9lotto.com/result/" + y + "-" + Number(m) + "-" + Number(dd));
      if (!nd) continue;
      const ns = parseNineDoc(nd);
      if (ns?.dateIso && ns.dateIso !== d) continue;
      const jp9 = nineJpFromDoc(nd);
      const six = ns ? nineSixFromPrizes(ns.prize) : null;
      const hasAny = (arr?: string[]) => !!arr && arr.some((v) => /^\d{4}$/.test(v));
      const jpRows = (jp9 && jp9.rows) || {};
      const hasJp = !!jp9 && (!!jp9.pool || Object.values(jpRows).some((v) => /\d/.test(v)));
      const hasData = (ns && (hasAny(ns.prize) || hasAny(ns.special) || hasAny(ns.cons))) || (six && six.main && !isDash(six.main)) || hasJp;
      if (hasData) cand.push({ dateLbl: weekdayOf(ns?.dateIso || d), ns, six, jp9 });
    }
    if (!cand.length) return;
    let use = cand[0];
    if (cand.length >= 2) {
      const t = cand[0];
      const y = cand[1];
      const a = t.six ? t.six.main : "----";
      const b = y.six ? y.six.main : "----";
      const newDraw = !!(t.ns && t.ns.drawNo && y.ns && y.ns.drawNo && t.ns.drawNo !== y.ns.drawNo);
      const today4 = (t.ns && t.ns.prize) || [];
      const yest4 = (y.ns && y.ns.prize) || [];
      const fourDiffers = today4.some((v, i) => !isDash(v) && v !== (yest4[i] || "----"));
      // Show today as soon as it differs at all (new draw number, a new 4D
      // number, or a new 6D) - even while the rest is still being revealed.
      if (!newDraw && !fourDiffers && (isDash(a) || a === b)) use = y;
    }
    const { dateLbl, ns, six, jp9 } = use;
    for (const nineCard of nineCards) {
      if (ns) {
        const dt = nineCard.querySelector('[data-id="date"]');
        // Never move the card back to an older draw.
        //
        // The date used to be written first, which defeated applySet's own
        // guard below: by the time applySet compared dates, the card already
        // carried the older one and matched. That is what flicked a live card
        // to yesterday's finished result and then back again.
        const curDay = dateScore(dt ? (dt.textContent || "") : "");
        const wantDay = dateScore(dateLbl);
        if (curDay && wantDay && wantDay < curDay) continue;
        if (dt && dt.textContent !== dateLbl) {
          setText(dt, dateLbl);
          // Only wipe the old numbers when the draw date actually changes.
          clearCardNumbers(nineCard);
        }
        if (ns.prize && ns.prize.length) applySet(nineCard, { ...ns, date: dateLbl });
      }
    }
    if (six && six.main && !isDash(six.main)) {
      applySixValues("table-18-2026-09-06-6d", { ...six, date: dateLbl });
      applyIdValues("table-18-2026-09-06-6d-jp", { date: dateLbl });
    } else {
      applySixValues("table-18-2026-09-06-6d", { main: "----", date: dateLbl });
      applyIdValues("table-18-2026-09-06-6d-jp", { date: dateLbl });
    }
    if (jp9) {
      const vals: Record<string, string> = {};
      if (jp9.pool) vals.n9_sj_pool = jp9.pool;
      if (jp9.rows) for (const [k, v] of Object.entries(jp9.rows)) if (v) vals[k] = v;
      applyIdValues("table-18-2026-09-06-6d-jp", vals);
    }
  } catch {
    // ignore
  }
}

function parseSGDate(txt: string): string | undefined {
  // Format: "Wed, 09 Sep 2026"
  const m = /^[A-Za-z]{3},\s*(\d{1,2})\s+([A-Za-z]{3}),?\s+(\d{4})/.exec((txt || "").trim());
  if (!m) return undefined;
  const months: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
  const mo = months[m[2]];
  if (!mo) return undefined;
  return weekdayOf(m[3] + "-" + mo + "-" + m[1].padStart(2, "0"));
}

/** Parse the latest Singapore Pools 4D draw from their official data file. */
function parseSGOfficial(doc: Document) {
  const li = doc.querySelector("li");
  if (!li) return null;
  const dateEl = li.querySelector(".drawDate");
  const noEl = li.querySelector(".drawNumber");
  const read = (sel: string) => { const e = li.querySelector(sel); return e ? (e.textContent || "").trim() : ""; };
  const prize = [".tdFirstPrize", ".tdSecondPrize", ".tdThirdPrize"].map(read);
  const starter = [...li.querySelectorAll(".tbodyStarterPrizes td")].map((e) => (e.textContent || "").trim()).slice(0, 10);
  const cons = [...li.querySelectorAll(".tbodyConsolationPrizes td")].map((e) => (e.textContent || "").trim()).slice(0, 10);
  const dm = noEl ? /Draw No\.?\s*([0-9]+)/.exec(noEl.textContent || "") : null;
  const dateLabel = dateEl ? parseSGDate(dateEl.textContent || "") : undefined;
  if (!prize.every((x) => /^\d{4}$/.test(x))) return null;
  return { dateLabel, drawNo: dm ? dm[1] : undefined, prize, starter, cons };
}

/** Use Singapore Pools’ own version token so its CDN cannot return a stale draw. */
function singaporeArchiveVersion(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric", month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "0";
  return get("year") + "y" + Number(get("month")) + "d" + Number(get("day")) + "h" + Number(get("hour")) + "m" + get("minute");
}
/** Update the Singapore 4D card from the official Singapore Pools data file. */
async function updateSGOfficial() {
  try {
    const u = "https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/fourd_result_top_draws_en.html?v=" + singaporeArchiveVersion();
    const txt = await fetchText(u);
    if (!txt) return;
    const doc = new DOMParser().parseFromString(txt, "text/html");
    const s = parseSGOfficial(doc);
    if (!s) return;
    const cards = [...document.querySelectorAll(".card.outer-box.table-11:not(.mkt-past)")];
    for (const card of cards) {
      const currentDate = card.querySelector('[data-id="date"]')?.textContent || "";
      if (s.dateLabel && dateScore(s.dateLabel) < dateScore(currentDate)) continue;
      const set = (id: string, v: string) => {
        const el = card.querySelector('[data-id="' + id + '"]');
        if (el && (el.textContent || "") !== v) { el.textContent = v; el.classList.remove("live-pending"); }
      };
      if (s.dateLabel) set("date", s.dateLabel);
      if (s.drawNo) set("draw_no", s.drawNo);
      (["first_prize", "second_prize", "third_prize"]).forEach((id, i) => set(id, s.prize[i]));
      s.starter.forEach((v, i) => set("special-" + (i + 1), v));
      set("special-11", "");
      s.cons.forEach((v, i) => set("consolation-" + (i + 1), v));
      flash(card);
    }
  } catch { /* ignore */ }
}

/** Fast Singapore result feed. The official archive can lag by several hours,
 *  while this feed publishes the current draw as soon as it is complete. */
async function updateSGFeed() {
  try {
    const u = "https://www.live4d2u.net/liveosx.json?ts=" + Date.now();
    const txt = await fetchText(u);
    if (!txt) return;
    const j = JSON.parse(txt);
    const s = j && j.S;
    if (!s) return;
    const cards = [...document.querySelectorAll(".card.outer-box.table-11:not(.mkt-past)")];
    for (const card of cards) {
      const cur = card.querySelector('[data-id="date"]');
      const curScore = dateScore(cur ? (cur.textContent || "") : "");
      if (s.DD && dateScore(String(s.DD)) < curScore) continue;
      const set = (id: string, v: string) => {
        const el = card.querySelector('[data-id="' + id + '"]');
        if (el && (el.textContent || "") !== v) { el.textContent = v; el.classList.remove("live-pending"); }
      };
      if (s.DD) set("date", String(s.DD));
      if (s.DN) set("draw_no", String(s.DN));
      (["first_prize", "second_prize", "third_prize"]).forEach((id, i) => set(id, feedDig(s["P" + (i + 1)])));
      for (let i = 1; i <= 10; i++) set("special-" + i, feedDig(s["S" + i]));
      set("special-11", "");
      for (let i = 1; i <= 10; i++) set("consolation-" + i, feedDig(s["C" + i]));
      flash(card);
    }
  } catch { /* ignore */ }
}
function feedDig(v: string | undefined): string {
  return v && /^\d{4}$/.test(v) ? v : "----";
}

/** Instant Cambodia fallback from the live4d2u.net live feed. Used only when the
 *  Grand Dragon card has no published number yet for today (e.g. mid-draw). */
async function updateCambodiaFeed() {
  try {
    const u = "https://www.live4d2u.net/liveosx.json?ts=" + Date.now();
    const txt = await fetchText(u);
    if (!txt) return;
    const j = JSON.parse(txt);
    // Sports Toto zodiac (12 animals) changes with each draw.
    if (j.T && j.T.ZODIAC) {
      const m = /src=['"]([^'"]+)['"]/.exec(String(j.T.ZODIAC));
      if (m) {
        const src = m[1].startsWith("http") ? m[1] : "https://www.live4d2u.net/" + m[1].replace(/^\/?/, "");
        for (const img of document.querySelectorAll(".card.outer-box.table-6:not(.mkt-past) img, .card.outer-box.table-7:not(.mkt-past) img")) {
          const im = img as HTMLImageElement;
          const cur = im.getAttribute("src") || "";
          if (cur.includes("zodiac") || (!cur.includes("logo") && cur !== src)) im.src = src;
        }
      }
    }
    if (!j || !j.G) return;
    const g = j.G;
    const cards = [...document.querySelectorAll(".card.outer-box.table-13:not(.mkt-past)")];
    if (!cards.length) return;
    const set = (card: Element, id: string, v: string) => {
      const el = card.querySelector('[data-id="' + id + '"]');
      if (el && (el.textContent || "") !== v) { el.textContent = v; el.classList.remove("live-pending"); }
    };
    for (const card of cards) {
      const f1 = card.querySelector('[data-id="first_prize"]');
      if (f1 && /^\d{4}$/.test((f1.textContent || "").trim())) continue; // already has today
      if (g.DD) set(card, "date", g.DD);
      (["first_prize", "second_prize", "third_prize"]).forEach((id, i) => set(card, id, feedDig(g["P" + (i + 1)])));
      for (let i = 1; i <= 13; i++) set(card, "special-" + i, feedDig(g["S" + i]));
      for (let i = 14; i <= 15; i++) set(card, "special-" + i, "");
      for (let i = 1; i <= 10; i++) set(card, "consolation-" + i, feedDig(g["C" + i]));
      flash(card);
    }
  } catch { /* ignore */ }
}

type FastFeed = {
  date: string;
  perdana: Record<string, PrizeSet | null>;
  hari: Record<string, { set: PrizeSet | null; six: SixSet | null; jp: Record<string, string> | null } | null>;
};

const PERDANA_ID: Record<string, string> = { "19:30": "table-16-2026-09-06-1930" };
const HARI_ID: Record<string, string> = { "15:30": "table-15-2026-09-06-1530", "19:30": "table-15-2026-09-06-1930" };

/** Apply a table-class -> { dataId: value } map to every matching card. */
function applyCardMap(cards: Record<string, Record<string, string>>) {
  for (const [cls, vals] of Object.entries(cards || {})) {
    for (const card of Array.from(document.querySelectorAll(".card.outer-box." + cls + ":not(.mkt-past)"))) {
      // A different draw date means the numbers on this card belong to the old
      // draw, so the new draw's published values are written even when they are
      // "----". Without this the date moved on while yesterday's numbers stayed
      // underneath it, which is exactly what confuses people.
      const dateEl = card.querySelector('[data-id="date"]');
      const curDate = dateEl ? (dateEl.textContent || "").trim() : "";
      const inDay = dateScore(vals.date), curDay = dateScore(curDate);
      if (inDay && curDay && inDay < curDay) continue;   // stale snapshot, skip this card
      const newDraw = !!vals.date && vals.date.trim() !== curDate;
      for (const [id, v] of Object.entries(vals)) {
        // Never blank a value a live source has already filled - the same rule
        // GamePager uses when it writes the server snapshot. The snapshot still
        // carries "----" for slots the official feed has not published yet, and
        // letting those overwrite good numbers made the cards rewrite (and
        // flash) on every single refresh.
        if (!v || v === "-") continue;
        if (/^----+$/.test(v) && !newDraw) continue;   // keep good numbers unless the draw changed
        setText(cellFor(card, id), v);
      }
      /*
       * Grand Dragon and Nine Lotto publish only thirteen special numbers
       * (A-M), but the card has fifteen cells - the last two are spare. A copy
       * of the 13th value was landing in cell 14, so 6787 and 1993 each showed
       * twice (reported 3 Oct 2026). Those slots can never hold a real number
       * for these games, so they are blanked here after every write.
       */
      if (cls === "table-13" || cls === "table-17") {
        // The operator leaves the cells that became the 1st/2nd/3rd prizes empty
        // and shows only their letter. The "never blank" rule above would
        // otherwise keep the number sitting there (reported 6 Oct 2026: the 3rd
        // prize 4940 was still shown in special cell A).
        const prizeNums = ["first_prize", "second_prize", "third_prize"].map((id) => {
          const el = card.querySelector('[data-id="' + id + '"]');
          return el ? (el.textContent || "").trim() : "";
        });
        for (let i = 1; i <= 13; i++) {
          const el = card.querySelector('[data-id="special-' + i + '"]');
          const v = el ? (el.textContent || "").trim() : "";
          if (el && /^\d{4}$/.test(v) && prizeNums.includes(v)) el.textContent = "----";
        }
        for (const id of ["special-14", "special-15"]) {
          const el = card.querySelector('[data-id="' + id + '"]');
          if (el && (el.textContent || "").trim() !== "----") el.textContent = "----";
        }
      }
      // A cell can still hold a stale repeat, or a marker like Sports Toto's
      // "****"; see cleanGrid().
      if (MIRROR_ONLY_CLASSES.includes(cls)) cleanGrid(card);
    }
  }
}

/** One fast request (server-cached, pre-warmed) that fills every live card. */
async function syncFromServerFast(): Promise<boolean> {
  try {
    const [homeRes, camRes] = await Promise.all([
      fetch("/api/home-live", { cache: "no-store" }).catch(() => null),
      fetch("/api/cambodia-live", { cache: "no-store" }).catch(() => null),
    ]);
    let did = false;
    if (homeRes && homeRes.ok) {
      const h = (await homeRes.json()) as { cards?: Record<string, Record<string, string>> };
      if (h && h.cards) { applyCardMap(h.cards); did = true; }
    }
    if (camRes && camRes.ok) {
      const j = (await camRes.json()) as FastFeed;
      did = applyCambodiaFeed(j) || did;
    }
    return did;
  } catch { return false; }
}

/** Apply the Perdana + HariHari values from the fast feed. */
function applyCambodiaFeed(j: FastFeed): boolean {
  {
    let did = false;
    for (const t of ["15:30", "19:30"]) {
      // Perdana dropped its 3:30PM draw on 1 Oct 2026 - only 7:30PM is fetched.
      const st = t === "19:30" && j.perdana ? j.perdana[t] : null;
      if (setHasAny(st)) {
        for (const card of Array.from(document.querySelectorAll('[id="' + PERDANA_ID[t] + '"]'))) { applySet(card, st); did = true; }
      }
      const h = j.hari ? j.hari[t] : null;
      // A draw that has started but published nothing yet still moves the card on.
      if (h && h.set) {
        for (const card of Array.from(document.querySelectorAll('[id="' + HARI_ID[t] + '"]'))) { applySet(card, h.set); did = true; }
        if (h.six) applySixValues(HARI_ID[t] + "-6d", h.six);
        if (h.jp) { applyIdValues(HARI_ID[t], h.jp); showJackpotLetter(HARI_ID[t], h.jp.jp_no || ""); }
      }
    }
    return did;
  }
}

/** Live updates for the phone pager: East games + Perdana + HariHari. */
async function syncEastHome() {
  // Sabah 88 numbers use special_number_N / consolation_number_N ids, which the
  // snapshot never publishes (it uses special-N / consolation-N), so this
  // mirror is its only writer and its gaps must be mirrored too.
  await syncLiveTable("https://live4dresult.net/sabah-sarawak-4d-results/", ["table-8", "table-9", "table-10"], ["table-10"]);
}
async function updatePerdanaHome() {
  for (const [time, id] of [["19:30", "table-16-2026-09-06-1930"]]) {
    for (const off of [0, -1]) {
      const d = dateStrNoPad(new Date(Date.now() + off * 86400000));
      const pd = await fetchDoc("https://www.perdana4d.com/Results/4D?processDate=" + d);
      if (!pd) continue;
      const st = parsePerdana(pd)[time];
      const cards = [...document.querySelectorAll('[id="' + id + '"]')];
      if (setHasAny(st)) { for (const card of cards) applySet(card, st); break; }
    }
  }
}
async function updateHariHome() {
  // The two draw times are independent and each is two round trips to the
  // HariHari API, so run them side by side instead of one after the other.
  await Promise.all([["15:30", "table-15-2026-09-06-1530"], ["19:30", "table-15-2026-09-06-1930"]].map(async ([time, id]) => {
    for (const off of [0, -1]) {
      const d = dateStrNoPad(new Date(Date.now() + off * 86400000));
      const txt = await fetchText(`https://api.hari4d.com/DrawResultL/GetDrawResult?date=${d}T${time}:00`);
      if (!txt) continue;
      try {
        const j = JSON.parse(txt);
        const set = hariSetFromJson(j);
        const cards = [...document.querySelectorAll('[id="' + id + '"]')];
        // Accept a started draw even with every cell still blank.
        if (!set) continue;
        for (const card of cards) applySet(card, set);
        applySixValues(id + "-6d", sixFromHariJson(j));
        try {
          const jr = await fetchText(`https://api.hari4d.com/Jackpot/GetJackpot?date=${d}T${time}:00`);
          if (jr) {
            const jp = JSON.parse(jr);
            if (jp && jp.jackpotAmount != null) {
              const vals: Record<string, string> = { jp_pool: "USD " + Number(jp.jackpotAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) };
              const nums: string[] = [];
              if (jp.number) nums.push(String(jp.number));
              if (jp.number2) nums.push(String(jp.number2));
              if (jp.jackpotShare != null) vals.jp_units = String(jp.jackpotShare);
              showJackpotLetter(id, nums.join(" or "));
              applyIdValues(id, vals);
            }
          }
        } catch { /* ignore */ }
        break;
      } catch { /* ignore */ }
    }
  }));
}

async function refreshOnce(full = true) {
  const path = syncPath();
  try {
    if (path === "/" || path === "/4dresults" || path === "/4dresults/") {
      // The server snapshot is pre-warmed and cheap, so it always runs. It holds
      // every card except HariHari (its API blocks our server) and Sabah 88
      // (whose cell ids never match), and the first cycle covers those two.
      const hari = full ? updateHariHome() : null;
      await syncFromServerFast();
      if (full) await Promise.all([
        // table-13 (Grand Dragon) is deliberately NOT mirrored from
        // live4dresult.net. That page's Special grid has blank cells where ours
        // holds numbers, and a blank source cell is skipped - so every later
        // number was written one column too early and the same number showed in
        // two cells (K and L). The card is kept current by the server snapshot
        // plus updateCambodiaFeed(), and both match the official board exactly.
        syncLiveTable("https://live4dresult.net/", [
          "table-1", "table-6", "table-4", "table-3", "table-2", "table-7", "table-5",
        ]),
        updateGdNineCards(),
        (async () => { await updateSGFeed(); await updateSGOfficial(); })(),
        updateCambodiaFeed(),
        syncEastHome(),
        updatePerdanaHome(),
        hari,
      ]);
    } else if (path === "/sabah-sarawak-4d-results") {
      await syncFromServerFast();
      if (full) await syncLiveTable("https://live4dresult.net/sabah-sarawak-4d-results/", ["table-8", "table-9", "table-10"]);
    } else if (path === "/singapore-4d-results") {
      await syncFromServerFast();
      if (full) {
        await syncLiveTable("https://live4dresult.net/singapore-4d-results/", ["table-12"]);
        await updateSGFeed();
        await updateSGOfficial();
      }
    } else if (path === "/lotto-4d" || path === "/cambodia-4d-results") {
      await syncFromServerFast();
      if (!full) return;
      // Grand Dragon (table-13) is NOT mirrored from live4dresult.net - see the
      // note in refresh(): that page's blank Special cells slid our numbers one
      // column left. updateCambodiaFeed() below writes them correctly.
      await updateGdNineCards();
      await updateCambodiaFeed();
      // Perdana 4D - one 7:30PM draw a day (latest completed date, fallback yesterday)
      for (const [time, id] of [["19:30", "table-16-2026-09-06-1930"]]) {
        for (const off of [0, -1]) {
          const d = dateStrNoPad(new Date(Date.now() + off * 86400000));
          const pd = await fetchDoc("https://www.perdana4d.com/Results/4D?processDate=" + d);
          if (!pd) continue;
          const mp = parsePerdana(pd);
          const st = mp[time];
          const card = document.getElementById(id);
          if (card && setHasAny(st)) { applySet(card, st); break; }
        }
      }
      // Lucky HariHari - two draws a day (JSON API, fallback yesterday)
      for (const [time, id] of [["15:30", "table-15-2026-09-06-1530"], ["19:30", "table-15-2026-09-06-1930"]]) {
        for (const off of [0, -1]) {
          const d = dateStrNoPad(new Date(Date.now() + off * 86400000));
          const txt = await fetchText(`https://api.hari4d.com/DrawResultL/GetDrawResult?date=${d}T${time}:00`);
          if (!txt) continue;
          try {
            const j = JSON.parse(txt);
            const set = hariSetFromJson(j);
            const card = document.getElementById(id);
            if (card && setHasAny(set)) {
              applySet(card, set);
              applySixValues(id + "-6d", sixFromHariJson(j));
              // Lucky HariHari Bonus Jackpot pool (official API, same draw slot)
              try {
                const jr = await fetchText(`https://api.hari4d.com/Jackpot/GetJackpot?date=${d}T${time}:00`);
                if (jr) {
                  const jp = JSON.parse(jr);
                  if (jp && jp.jackpotAmount != null) {
                    const vals: Record<string, string> = {
                      jp_pool: "USD " + Number(jp.jackpotAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    };
                    const nums: string[] = [];
                    if (jp.number) nums.push(String(jp.number));
                    if (jp.number2) nums.push(String(jp.number2));
                    if (jp.jackpotShare != null) vals.jp_units = String(jp.jackpotShare);
              showJackpotLetter(id, nums.join(" or "));
                    applyIdValues(id, vals);
                  }
                }
              } catch { /* ignore */ }
              break;
            }
          } catch { /* ignore */ }
        }
      }
    }
  } catch {
    // ignore transient failures
  }
}

export default function LiveResults() {
  useEffect(() => {
    let alive = true;
    let busy = false;
    let timer: number | undefined;
    // Instant results: restore the values we showed on the last visit, and if
    // there is no cache yet, blank the baked-in values so an old draw date /
    // number is never displayed while the fresh result is loading.
    const bootPath = syncPath();
    const bootClasses = syncedTableClasses(bootPath);
    // The inline boot script already wrote the current numbers into the page,
    // so there is nothing stale to hide or restore.
    const booted = (window as unknown as { __MKT_BOOT__?: boolean }).__MKT_BOOT__ === true;
    const hadCache = booted ? true : applySnapshot();
    if (!hadCache && !booted && bootClasses.length) maskStaleCards(bootClasses);
    // Keep the cache warm independently of the sync (a slow source must never
    // delay the "instant results" copy of the values on screen).
    collectSnapshot();
    const snapTimer = window.setInterval(() => {
      if (alive && document.visibilityState === "visible") collectSnapshot();
    }, 15000);
    // If a source is unreachable the built-in values come back after 7s.
    const restoreTimer = window.setTimeout(() => { if (alive) restoreUnfilled(); }, 7000);
    // The first cycle always reads every source, so a freshly opened page is
    // fully populated. After that the cheap server snapshot carries the page
    // every few seconds, and the expensive sweep across every outside site
    // runs at most once every 45 seconds. Running that sweep on every 8 second
    // tick meant a phone fired ~8 third-party requests again and again during a
    // draw, which is what made opening and switching games crawl.
    let firstCycle = true;
    let lastFull = 0;
    const FULL_SWEEP_MS = 45000;
    /*
     * Cheap lane - the pre-warmed server snapshot, once a second.
     *
     * The main tick below can spend up to nine seconds sweeping the outside
     * sites, and while it is busy NOTHING on the page updates. A number the
     * server already held could therefore sit unseen for the length of that
     * sweep, on top of the snapshot's own age - which is how the app ended up
     * roughly twenty seconds behind other 4D apps during a draw, for every one
     * of the eleven games (reported 3 Oct 2026).
     *
     * This lane touches only /api/home-live and /api/cambodia-live. Both are
     * edge-cached and were measured at 150-300ms, so it can run every second
     * without loading any third-party site. The expensive sweep stays on the
     * 45-second cadence, because that is what keeps the source sites happy.
     */
    let fastBusy = false;
    let lastFast = 0;
    const fastPoll = async () => {
      if (fastBusy || !alive) return;
      // Outside a draw a slower beat is plenty; the app is on screen, so a
      // number published out of the usual hours still shows up within a second.
      // No clock rule: a page that still has a card being revealed is checked
      // every second, and a page where every card is finished is checked every
      // few seconds - just enough to notice the next draw starting.
      if (Date.now() - lastFast < (anyLiveCard() ? 1000 : 5000)) return;
      fastBusy = true;
      try { await syncFromServerFast(); lastFast = Date.now(); }
      catch { /* picked up on the next tick */ }
      finally { fastBusy = false; }
    };
    lastFast = Date.now();
    /*
     * HariHari's draw carries its 1st/2nd/3rd prize letters inside the same
     * payload as the numbers - but only the phone can fetch it (the operator's
     * API refuses our server) and it used to run on the slow sweep alone. So the
     * number arrived first and its letter up to a minute later, or not at all if
     * that sweep was cut short. It now rides the fast lane, throttled, and only
     * while a draw is actually being published.
     */
    let lastHari = 0;
    const hariPoll = async () => {
      if (!alive || !inDrawWindow()) return;
      if (Date.now() - lastHari < 15000) return;
      lastHari = Date.now();
      try { await updateHariHome(); } catch { /* picked up on the next tick */ }
    };
    const fastTimer = window.setInterval(() => {
      if (document.visibilityState === "visible" && alive) { void fastPoll(); void hariPoll(); }
    }, 1000);
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        const wantFull = firstCycle || (inDrawWindow() && Date.now() - lastFull >= FULL_SWEEP_MS);
        // Cap one refresh cycle. Sources are fetched in sequence in places, and
        // a single unresponsive host used to hold the tick open for up to a
        // minute - the page then showed nothing new for any game until it gave
        // up. Whatever has not answered by now simply gets picked up next tick.
        await Promise.race([
          refreshOnce(wantFull),
          new Promise((r) => window.setTimeout(r, wantFull ? 9000 : 5000)),
        ]);
        if (wantFull) lastFull = Date.now();
        firstCycle = false;
        if (alive) collectSnapshot();
      } finally {
        busy = false;
      }
      if (!alive) return;
      timer = window.setTimeout(tick, nextInterval());
    };
    timer = window.setTimeout(tick, 0);
    const onVis = () => {
      if (document.visibilityState === "visible" && alive) {
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
      window.clearInterval(fastTimer);
      window.clearInterval(snapTimer);
      window.clearTimeout(restoreTimer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return null;
}
