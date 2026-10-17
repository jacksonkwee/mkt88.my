"use client";

import { useEffect } from "react";
import { gameBySlug } from "./GameDefs";
import { markLiveValue, copyMayWrite } from "./snapshot-values";

/**
 * LiveResults - updates the rendered tables in place, without a page reload.
 *
 * Almost every value comes from the server snapshot, which reads the operators
 * itself (lib/live-snapshot.ts) and shape-checks each source. The phone only
 * fetches for itself what the server cannot cover from there.
 *
 * Perdana 4D and Lucky HariHari used to be on that list, because their sites
 * were thought to refuse our server. Measured on 15 Oct 2026 both answer it -
 * api.hari4d.com returned 200 with the live draw, and perdana4d.com answered in
 * about two seconds - so those two cards now have exactly one writer, the
 * server, and the phone no longer reads them at all.
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
 * Don't pay twice for the same page inside one sweep.
 *
 * Every game that needs a source runs on its own clock, so one sweep used to ask
 * for the same operator page several times in the same second. A second caller
 * now joins a request that is already running, and a copy fetched a moment ago
 * is reused, so those duplicate requests are gone and the operator sites get
 * fewer hits per sweep. Two seconds is far shorter than any cycle that asks for
 * these pages (the sweep runs at most once every 45s), so nothing shows staler
 * than the sweep already was. A failure is neither shared nor remembered: a
 * caller still retries exactly as it does today.
 */
const FETCH_REUSE_MS = 2000;
const recentText = new Map<string, { at: number; text: string }>();
const inFlightText = new Map<string, Promise<string | null>>();

async function fetchText(url: string): Promise<string | null> {
  const hit = recentText.get(url);
  if (hit && Date.now() - hit.at < FETCH_REUSE_MS) return hit.text;

  const running = inFlightText.get(url);
  if (running) {
    const shared = await running;
    if (shared !== null) return shared;
  }

  const p = fetchTextOnce(url);
  inFlightText.set(url, p);
  let text: string | null = null;
  try {
    text = await p;
  } finally {
    inFlightText.delete(url);
  }
  if (text !== null) {
    const now = Date.now();
    for (const [k, v] of recentText) if (now - v.at >= FETCH_REUSE_MS) recentText.delete(k);
    recentText.set(url, { at: now, text });
  }
  return text;
}

async function fetchTextOnce(url: string): Promise<string | null> {
  try {
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

function setText(el: Element | null, v: string, live = false) {
  if (!el) return;
  // A 6D sub-prize (2nd..5th) must never be blanked by a source that does not
  // carry it - otherwise the good value is wiped right after it appears.
  const id = el.getAttribute("data-id") || "";
  if (/^six_/.test(id) && /^----+$/.test(v.trim())) return;
  if (el.textContent !== v) el.textContent = v;
  el.classList.remove("live-pending");
  /*
   * A phone-side write is stamped with the moment it happened, so a copy of the
   * snapshot built before that moment may not put its older value back. Without
   * the stamp the older copy wins every second and the number blinks (see
   * markLiveValue in snapshot-values.ts).
   */
  if (live) markLiveValue(el, v);
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

/**
 * How many special numbers each game really publishes.
 *
 * The cards all carry fifteen slots, but most games use fewer, and a slot past
 * the end of the grid is not a result - it is a leftover the mirror sweep keeps
 * writing back. Sandakan's last three numbers appeared a second time in cells
 * 11 to 13, and Da Ma Cai's tenth again in cell 11 (reported 7 Oct 2026). Kept
 * in step with SPECIAL_SLOTS in lib/live-snapshot.ts. Sandakan publishes
 * thirteen boxes, three of them blank by design - the specials that became its
 * 1st/2nd/3rd prize - so its grid runs to box 13.
 */
const SPECIAL_SLOTS: Record<string, number> = {
  "table-1": 13, "table-4": 10, "table-5": 10, "table-6": 13,
  "table-8": 13, "table-9": 10, "table-10": 13, "table-11": 10,
  "table-13": 13, "table-17": 13,
};

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

function applySet(card: Element, s: PrizeSet, live = false, copyDate = "") {
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
    /*
     * A copy of the snapshot built before this cell was last written by a
     * phone-side source carries older news: writing it back is what made a
     * number blink. A cell nobody wrote has no stamp, so the operator's
     * deliberate blanks are still taken exactly as they are today.
     */
    if (!copyMayWrite(el, s.date || copyDate, curDate)) return;
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
  s.prize.forEach((v, i) => {
    const row = prizeRows[i];
    const cell = row ? row.querySelector("td.lottery-prize-number") : null;
    if (cell) {
      // The letter goes on the cell, NOT into its text - the same way Grand
      // Dragon has always drawn its 1st-3rd prize letters. Writing "D 9330"
      // into the text instead broke the number-history tap and the
      // newest-number flash, which both read the cell's digits.
      const L = ((s.from || [])[i] || "").trim().toUpperCase();
      // The operator knows which special a prize came from before it prints the
      // number. A letter with no number reads as a mistake, so it waits.
      if (/^[A-W]$/.test(L) && /^\d{3,6}$/.test(String(v ?? "").trim())) cell.setAttribute("data-letter", L);
      else cell.removeAttribute("data-letter");
    }
    stage(cell, v, true);
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
    if (dt && dt.textContent !== s.date && copyMayWrite(dt, s.date || copyDate, curDate)) pending.unshift({ el: dt, v: s.date });
  }
  if (s.drawNo) {
    const dn = card.querySelector('[data-id="draw_no"]');
    if (dn && dn.textContent !== s.drawNo && copyMayWrite(dn, s.date || copyDate, curDate)) pending.push({ el: dn, v: s.drawNo });
  }
  if (pending.length === 0) return;
  // Write the whole draw in one pass. The old reveal (90ms per cell) made a
  // full HariHari card take over two seconds to fill in, number by number.
  for (const c of pending) setText(c.el, c.v, live);
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

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
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

function applySixValues(cardId: string, s: SixSet | null, live = false, copyDate = "") {
  if (!s) return;
  applyToCardsById(cardId, (card) => {
    const cardDate = (card.querySelector('[data-id="date"]')?.textContent || "").trim();
    const pending = new Map<string, string>();
    const stage = (id: string, v: string | undefined) => {
      if (v === undefined) return;
      const el = card.querySelector('[data-id="' + id + '"]');
      if (!el) return;
      if ((el.textContent || "").trim() === v.trim()) return;
      if (!copyMayWrite(el, s.date || copyDate, cardDate)) return;   // the phone's own board stands
      pending.set(id, v.trim());
    };
    stage("six_main", s.main);
    if (s.date) stage("date", s.date);
    // Never blank a 6D sub-prize that we do not have a real value for.
    if (s.subs) for (const [k, v] of Object.entries(s.subs)) { if (!isDash(v)) stage(k, v); }
    if (pending.size === 0) return;
    // Write the whole card in one pass; the old reveal was 140ms per field.
    for (const [id, v] of pending) setText(card.querySelector('[data-id="' + id + '"]'), v, live);
    flash(card);
  });
}

function applyIdValues(cardId: string, vals: Record<string, string>, live = false, copyDate = "") {
  applyToCardsById(cardId, (card) => {
    const cardDate = (card.querySelector('[data-id="date"]')?.textContent || "").trim();
    const pending: { el: Element; v: string }[] = [];
    for (const [id, v] of Object.entries(vals)) {
      const el = card.querySelector('[data-id="' + id + '"]');
      if (!el) continue;
      if ((el.textContent || "").trim() === v.trim()) continue;
      if (!copyMayWrite(el, vals.date || copyDate, cardDate)) continue;
      pending.push({ el, v: v.trim() });
    }
    if (pending.length === 0) return;
    // Write the whole card in one pass; the old reveal was 140ms per field.
    for (const c of pending) setText(c.el, c.v, live);
    flash(card);
  });
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
      "https://gdlotto.com/results/ajax/_result.aspx?past=1&v=1&d=" + mo + "/" + dd + "/" + y
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
    /*
     * A letter with no number yet is the CURRENT draw's jackpot letter, not a
     * stale value.
     *
     * The operator publishes the letter the moment the draw opens and attaches
     * the winning number afterwards. While it is pending it writes "F :", not a
     * bare "F". The old test asked whether the whole value was exactly one
     * letter, so "F :" failed it, fell through, and the letter was blanked to
     * "----" for the whole live window - it only appeared once the number
     * arrived, which is why the row looked empty all evening (reported 8 Oct
     * 2026: yesterday was E, the operator had F, the app showed "----").
     */
    const bare = /^\s*([A-M])\s*:?\s*$/i.exec(String(raw));
    if (bare) return { ...jp4, jp4_letter: bare[1].toUpperCase() };
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

/**
 * True when a special's own box is clear.
 *
 * When a number is drawn up into a 1st-3rd prize the operator leaves its
 * special box blank, so an empty box is the board's own way of saying "this
 * special became a prize". A letter whose box still holds a number cannot be
 * this draw's letter, which is how a stale feed letter is told apart.
 */
function specialBoxBlank(card: Element, letter: string): boolean {
  const i = LETTERS.indexOf(letter);
  if (i < 0) return false;
  const el = card.querySelector('[data-id="special-' + (i + 1) + '"]');
  if (!el) return true;   // nothing to check against: keep the feed's letter
  const v = (el.textContent || "").trim();
  return v === "" || /^----+$/.test(v);
}

async function updateGdNineCards() {
  // Grand Dragon 6D + 4D jackpot + 6+1D jackpot (official gdlotto endpoint)
  try {
    const gd = await gdInfo();
    if (gd) {
      // live = true on every write in here: this is the phone reading the
      // operator itself, so what it learns is stamped (see markLiveValue).
      applySixValues("table-14-2026-09-06-6d", gd.six, true);
      // The jackpot card is its own card - keep its date in step too.
      if (gd.six.date) applyIdValues("table-14-2026-09-06-6d-jp", { date: gd.six.date }, true);
      applyIdValues("table-13-2026-09-06", liveJackpotLetter("table-13-2026-09-06", gd.jp4), true);
      for (const [key, id] of [["p1", "first_prize"], ["p2", "second_prize"], ["p3", "third_prize"]] as [string, string][]) {
        const L = gd.jp4[key];
        applyToCardsById("table-13-2026-09-06", (card) => {
          const cell = card.querySelector('[data-id="' + id + '"]');
          if (!cell) return;
          const num = (cell.textContent || "").trim();
          /*
           * The letter must belong to the draw that is on the card.
           *
           * The operator puts up which special each prize came from only at the
           * end of the draw, so while it is running the feed still carries the
           * PREVIOUS draw's letters - which is why the 1st-3rd rows showed a
           * wrong letter and only corrected themselves once the draw finished
           * (reported 13 Oct 2026). The board itself says which is right: the
           * special a prize came from is left BLANK. A letter whose box still
           * holds a number belongs to an older draw, so it is not shown.
           */
          if (L && /^[A-M]$/.test(L) && /^\d{4}$/.test(num) && specialBoxBlank(card, L)) cell.setAttribute("data-letter", L);
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
        setText(dt, dateLbl, true);
          // Only wipe the old numbers when the draw date actually changes.
          clearCardNumbers(nineCard);
        }
        if (ns.prize && ns.prize.length) applySet(nineCard, { ...ns, date: dateLbl });
      }
    }
    if (six && six.main && !isDash(six.main)) {
        applySixValues("table-18-2026-09-06-6d", { ...six, date: dateLbl }, true);
        applyIdValues("table-18-2026-09-06-6d-jp", { date: dateLbl }, true);
    } else {
        applySixValues("table-18-2026-09-06-6d", { main: "----", date: dateLbl }, true);
        applyIdValues("table-18-2026-09-06-6d-jp", { date: dateLbl }, true);
    }
    if (jp9) {
      const vals: Record<string, string> = {};
      if (jp9.pool) vals.n9_sj_pool = jp9.pool;
      if (jp9.rows) for (const [k, v] of Object.entries(jp9.rows)) if (v) vals[k] = v;
        applyIdValues("table-18-2026-09-06-6d-jp", vals, true);
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
  /** When the server built this copy (ms) - see writtenAfterCopy. */
  at?: number;
  perdana: Record<string, PrizeSet | null>;
  hari: Record<string, { set: PrizeSet | null; six: SixSet | null; jp: Record<string, string> | null } | null>;
};

const PERDANA_ID: Record<string, string> = { "15:30": "table-16-2026-09-06-1530", "19:30": "table-16-2026-09-06-1930" };
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
        /*
         * Magnum is taken exactly as the snapshot has it, blanks included. It
         * is the only game with no second writer on the phone - the operator's
         * feed and both mirrors are already merged into that one snapshot
         * server-side - so refusing its blanks only ever kept a value the
         * snapshot had deliberately cleared: a prize number left in the special
         * row, or the mirror's spare 14th slot, stayed on the card for good.
         */
        if (/^----+$/.test(v) && !newDraw && cls !== "table-1") continue;   // keep good numbers unless the draw changed
        const el = cellFor(card, id);
        /*
         * A cell a phone-side source has written holds the operator's own
         * board; this copy is not allowed to undo it unless it is for a NEWER
         * draw (see copyMayWrite). A cell nobody wrote has no stamp, so today's
         * clearing still happens exactly as it did.
         */
        if (!copyMayWrite(el, vals.date, curDate)) continue;
        setText(el, v);
      }
      /*
       * Grand Dragon and Nine Lotto publish only thirteen special numbers
       * (A-M), but the card has fifteen cells - the last two are spare. A copy
       * of the 13th value was landing in cell 14, so 6787 and 1993 each showed
       * twice (reported 3 Oct 2026). Those slots can never hold a real number
       * for these games, so they are blanked here after every write.
       */
      /*
       * Magnum is in this group for the same reason. It also publishes thirteen
       * specials into a fifteen-cell grid, and the mirror's Magnum board comes
       * through one cell short near the end - so the 13th number appeared in
       * cell 14 as well, and the three numbers drawn as the top prizes were
       * left sitting in the special row beside them, because the "never blank"
       * rule above refused the operator's empty cells (reported 7 Oct 2026).
       */
      if (cls === "table-1" || cls === "table-13" || cls === "table-17") {
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
      }
      // Slots past the end of this game's grid are never a result: see
      // SPECIAL_SLOTS. Checked for every card, so a leftover the mirror sweep
      // writes back is cleared on the next pass instead of staying all evening.
      const used = SPECIAL_SLOTS[cls];
      if (used) {
        for (let i = used + 1; i <= 15; i++) {
          const el = card.querySelector('[data-id="special-' + i + '"]');
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
    // The draw this copy is for: a cell the phone wrote stands unless this copy
    // is for a NEWER draw (see copyMayWrite).
    const copyDate = j.date || "";
    for (const t of ["15:30", "19:30"]) {
      const st = j.perdana ? j.perdana[t] : null;
      if (setHasAny(st)) {
        for (const card of Array.from(document.querySelectorAll('[id="' + PERDANA_ID[t] + '"]'))) { applySet(card, st, false, copyDate); did = true; }
      }
      const h = j.hari ? j.hari[t] : null;
      // A draw that has started but published nothing yet still moves the card on.
      if (h && h.set) {
        for (const card of Array.from(document.querySelectorAll('[id="' + HARI_ID[t] + '"]'))) { applySet(card, h.set, false, copyDate); did = true; }
        if (h.six) applySixValues(HARI_ID[t] + "-6d", h.six, false, copyDate);
        if (h.jp) { applyIdValues(HARI_ID[t], h.jp, false, copyDate); showJackpotLetter(HARI_ID[t], h.jp.jp_no || ""); }
      }
    }
    return did;
  }
}

/*
 * The three East games are NOT mirrored from live4dresult.net any more.
 *
 * The server snapshot already fills them from each operator's own board -
 * Sandakan from stc4d.com, Cash Sweep from cashsweep.com.my and Sabah 88 from
 * sabah88.net - in the operator's own box order. The mirror page lays its last
 * three specials out one box further right than the operator does (its cell 14
 * carries what the operator prints in box 13), so copying it over the card put
 * a number in the wrong box and, where our cell 14 was empty, printed the same
 * number twice (reported 11 Oct 2026). Its card positions are simply not the
 * operator's positions.
 */
async function refreshOnce(full = true) {
  const path = syncPath();
  try {
    if (path === "/" || path === "/4dresults" || path === "/4dresults/") {
      // The server snapshot is pre-warmed and cheap, so it always runs, and it
      // now holds every card on this page - Perdana 4D and Lucky HariHari
      // included, which the server reads itself.
      await syncFromServerFast();
      if (full) await Promise.all([
        /*
         * The phone no longer mirrors the aggregator's pages (decided 15 Oct
         * 2026, steps 3+4 of the "stop patching all night" plan).
         *
         * This was the biggest of the phone's writers, and it wrote the same
         * cards the server snapshot already carries from the operators - so two
         * copies of the same board were racing, which is what made numbers
         * appear, vanish and come back. Those cards now have exactly one writer:
         * the server. The data itself is unchanged - the server reads the same
         * pages while it builds the snapshot, and every source it uses is shape
         * checked (see lib/source-health.ts).
         */
        updateGdNineCards(),
        updateSGOfficial(),
        updateCambodiaFeed(),
      ]);
    } else if (path === "/sabah-sarawak-4d-results") {
      await syncFromServerFast();
    } else if (path === "/singapore-4d-results") {
      await syncFromServerFast();
      if (full) {
        // Same rule as the home page: the Singapore Toto card comes from the
        // server snapshot, not from a second copy fetched by the phone.
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
    /*
     * A page whose snapshot is empty is the one case where the baked markup is
     * all there is - and that markup is the 6 September capture, which must
     * never be read as a result. Mask it until the first sync writes the live
     * board (reported 17 Oct 2026: Magnum showed 06-09 for four seconds, and
     * eighteen on one run).
     */
    const bootSnap = (window as unknown as { __MKT_SNAP__?: { cards?: Record<string, unknown> } }).__MKT_SNAP__;
    const snapEmpty = !bootSnap || !bootSnap.cards || !Object.keys(bootSnap.cards).length;
    const hadCache = booted && !snapEmpty ? true : applySnapshot();
    if (!hadCache && bootClasses.length) maskStaleCards(bootClasses);
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
    const fastTimer = window.setInterval(() => {
      if (document.visibilityState === "visible" && alive) void fastPoll();
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
