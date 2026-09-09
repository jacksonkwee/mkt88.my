"use client";

import { useEffect, useState } from "react";
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
function nextInterval(): number {
  const h = myHourNow();
  return h >= 18 && h <= 21 ? 10000 : 25000;
}

type PrizeSet = { prize: string[]; special: string[]; cons: string[]; date?: string; drawNo?: string };

function isDash(v: string) {
  const t = (v || "").trim();
  return /^----+$/.test(t) || t === "";
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch("/api/live?u=" + encodeURIComponent(url), { cache: "no-store" });
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

function weekdayOf(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  const parts = iso.split("-");
  const wk = d.toLocaleDateString("en-US", { weekday: "short" });
  return `${parts[2]}-${parts[1]}-${parts[0]} (${wk})`;
}

function setText(el: Element | null, v: string) {
  if (el && el.textContent !== v) el.textContent = v;
}

async function syncLiveTable(url: string, tableClasses: string[]) {
  const doc = await fetchDoc(url);
  if (!doc) return;
  for (const cls of tableClasses) {
    const srcCard = doc.querySelector(".card.outer-box." + cls);
    const target = document.querySelector(".card.outer-box." + cls);
    if (!srcCard || !target) continue;
    // Mirror the source exactly (both directions). When the official draw is
    // cleared for the new draw date the numbers are wiped to "----" first;
    // when the draw is released the numbers are revealed one by one in draw
    // order (1st -> 2nd -> 3rd -> special -> consolation).
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
      pending.set(id, v);
      if (isDash(v) && !isDash(cur)) hasClear = true;
    }
    if (pending.size === 0) continue;
    if (hasClear) {
      // New draw date / draw not out yet: wipe instantly (including the date).
      for (const [id, v] of pending) {
        const el = target.querySelector('[data-id="' + id + '"]');
        setText(el, v);
      }
      flash(target);
      continue;
    }
    // Filling / updating: reveal each changed number one by one in draw order.
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
  }
}

function flash(card: Element) {
  card.classList.add("live-flash");
  setTimeout(() => card.classList.remove("live-flash"), 900);
}

function applySet(card: Element, s: PrizeSet) {
  if (!s || !s.prize || s.prize.length === 0) return;
  if (s.prize.every(isDash)) return; // draw not available yet
  const pending: { el: Element; v: string }[] = [];
  const stage = (el: Element | null, v: string | undefined) => {
    if (!el || v === undefined) return;
    const cur = (el.textContent || "").trim();
    if (cur === v.trim() || isDash(v)) return;
    pending.push({ el, v: v.trim() });
  };
  const tables = [...card.querySelectorAll("table")];
  const prizeRows = tables[0] ? [...tables[0].querySelectorAll("tr")] : [];
  s.prize.forEach((v, i) => {
    const row = prizeRows[i];
    stage(row ? row.querySelector("td.lottery-prize-number") : null, v);
  });
  const specialCells = tables[1] ? [...tables[1].querySelectorAll("td.lottery-number")] : [];
  s.special.forEach((v, i) => stage(specialCells[i], v));
  if (s.special.length > 0 && specialCells.length > s.special.length) {
    for (let i = s.special.length; i < specialCells.length; i++) {
      if (specialCells[i]) (specialCells[i] as HTMLElement).innerHTML = "&nbsp;";
    }
  }
  const consCells = tables[2] ? [...tables[2].querySelectorAll("td.lottery-number")] : [];
  s.cons.forEach((v, i) => stage(consCells[i], v));
  if (s.date) {
    const dt = card.querySelector('[data-id="date"]');
    if (dt && dt.textContent !== s.date) pending.unshift({ el: dt, v: s.date });
  }
  if (s.drawNo) {
    const dn = card.querySelector('[data-id="draw_no"]');
    if (dn && dn.textContent !== s.drawNo) pending.push({ el: dn, v: s.drawNo });
  }
  if (pending.length === 0) return;
  // Reveal one by one in draw order, then flash the card.
  pending.forEach((c, i) => window.setTimeout(() => setText(c.el, c.v), 90 * i));
  window.setTimeout(() => flash(card), 90 * pending.length);
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
  if (!j || !j.prize1) return null;
  const special = LETTERS.map((L) => String(j["prize" + L] ?? "----"));
  const cons = CONS_LETTERS.map((L) => String(j["prize" + L] ?? "----"));
  const iso = typeof j.drawDate === "string" ? j.drawDate.slice(0, 10) : undefined;
  return {
    prize: [j.prize1, j.prize2, j.prize3].map((x) => String(x)),
    special,
    cons,
    drawNo: j.id != null ? String(j.id) : undefined,
    date: iso ? weekdayOf(iso) : undefined,
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

function applySixValues(cardId: string, s: SixSet | null) {
  if (!s) return;
  const card = document.getElementById(cardId);
  if (!card) return;
  const pending = new Map<string, string>();
  let hasClear = false;
  const stage = (id: string, v: string | undefined) => {
    if (v === undefined) return;
    const el = card.querySelector('[data-id="' + id + '"]');
    if (!el) return;
    const cur = (el.textContent || "").trim();
    if (cur === v.trim()) return;
    pending.set(id, v.trim());
    if (isDash(v) && !isDash(cur)) hasClear = true;
  };
  stage("six_main", s.main);
  if (s.date) stage("date", s.date);
  if (s.subs) for (const [k, v] of Object.entries(s.subs)) stage(k, v);
  if (pending.size === 0) return;
  if (hasClear) {
    for (const [id, v] of pending) {
      const el = card.querySelector('[data-id="' + id + '"]');
      setText(el, v);
    }
    flash(card);
    return;
  }
  const els = [...card.querySelectorAll("[data-id]")];
  const changed: { el: Element; v: string }[] = [];
  for (const el of els) {
    const id = el.getAttribute("data-id") || "";
    if (!pending.has(id)) continue;
    changed.push({ el, v: pending.get(id)! });
  }
  changed.forEach((c, i) => window.setTimeout(() => setText(c.el, c.v), 140 * i));
  window.setTimeout(() => flash(card), 140 * changed.length);
}

function applyIdValues(cardId: string, vals: Record<string, string>) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const pending = new Map<string, string>();
  let hasClear = false;
  for (const [id, v] of Object.entries(vals)) {
    const el = card.querySelector('[data-id="' + id + '"]');
    if (!el) continue;
    const cur = (el.textContent || "").trim();
    if (cur === v.trim()) continue;
    pending.set(id, v.trim());
    if (isDash(v) && !isDash(cur)) hasClear = true;
  }
  if (pending.size === 0) return;
  if (hasClear) {
    for (const [id, v] of pending) {
      const el = card.querySelector('[data-id="' + id + '"]');
      setText(el, v);
    }
    flash(card);
    return;
  }
  const els = [...card.querySelectorAll("[data-id]")];
  const changed: { el: Element; v: string }[] = [];
  for (const el of els) {
    const id = el.getAttribute("data-id") || "";
    if (!pending.has(id)) continue;
    changed.push({ el, v: pending.get(id)! });
  }
  changed.forEach((c, i) => window.setTimeout(() => setText(c.el, c.v), 140 * i));
  window.setTimeout(() => flash(card), 140 * changed.length);
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

function dateFromNineText(text: string): string | undefined {
  const m = /([A-Za-z]{3}),\s*([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})/.exec(text || "");
  if (!m) return undefined;
  const months: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
  const mo = months[m[2]];
  if (!mo) return undefined;
  return weekdayOf(m[4] + "-" + mo + "-" + m[3].padStart(2, "0"));
}

type GdInfo = { six: SixSet; jp4: Record<string, string>; jp7: Record<string, string> };

/** Grand Dragon 6D + Jackpots - today and yesterday are compared. The official
 *  dated feed returns the previous draw again until today's is published, so a
 *  result is only labelled "today" when today's six-digit number differs from
 *  yesterday's. Otherwise yesterday is shown with its own date. */
function parseNineDoc(doc: Document): { prize: string[]; special: string[]; cons: string[]; drawNo?: string } | null {
  const text = doc.body ? doc.body.innerText : "";
  const tokens = text.split(/\s+/).map((l) => l.trim()).filter(Boolean);
  const idx = tokens.findIndex((l) => /^DRAW$/.test(l) || /^NO:$/.test(l));
  if (idx < 0) return null;
  const dm = /(\d+)\/(\d{4})/.exec(tokens.slice(idx, idx + 6).join(" "));
  const prize: string[] = [];
  const special: string[] = [];
  const cons: string[] = [];
  for (let k = idx + 1; k < tokens.length - 1; k++) {
    const a = tokens[k];
    if (/^(2D|3D|6D|JACKPOT|SUPER|CONTACT)$/i.test(a)) break;
    if (/^[A-W]$/.test(a) && tokens[k + 1] === ":") {
      const nv = /^(----|\d{4})$/.exec(tokens[k + 2] || "");
      if (nv) { if (a >= "N" && a <= "W") cons.push(nv[1]); else special.push(nv[1]); k += 2; continue; }
    }
    if (/^[A-W]$/.test(a) && /^(----|\d{4})$/.test(tokens[k + 1]) && tokens[k + 2] !== ":") {
      if (prize.length < 3) prize.push(tokens[k + 1]);
      k++;
    }
  }
  while (prize.length < 3) prize.push("----");
  return { prize, special: special.slice(0, 13), cons: cons.slice(0, 10), drawNo: dm ? dm[1] + "/" + dm[2] : undefined };
}

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
    cand.push({ six, jp4, jp7 });
  }
  if (!cand.length) return null;
  let use = cand[0];
  if (cand.length >= 2) {
    const a = cand[0].six.main;
    const b = cand[1].six.main;
    if (isDash(a) || a === b) use = cand[1];
  }
  return use;
}

async function updateGdNineCards() {
  // Grand Dragon 6D + 4D jackpot + 6+1D jackpot (official gdlotto endpoint)
  try {
    const gd = await gdInfo();
    if (gd) {
      applySixValues("table-14-2026-09-06-6d", gd.six);
      applyIdValues("table-13-2026-09-06", gd.jp4);
      applyIdValues("table-14-2026-09-06-6d", gd.jp7);
    }
  } catch {
    // ignore
  }
  // Nine Lotto - today and yesterday are compared. The official dated page
  // returns yesterday's numbers again when today's draw is not published yet,
  // so we only label results "today" when today's six-digit draw differs from
  // yesterday's (i.e. a genuinely new draw). Otherwise yesterday's date is shown.
  try {
    const nineCard = document.querySelector(".card.outer-box.table-17");
    const cand: { dateLbl: string; ns: ReturnType<typeof parseNineDoc>; six: SixSet | null; jp9: ReturnType<typeof nineJpFromDoc> }[] = [];
    for (let off = 0; off <= 1; off++) {
      const d = dateStrNoPad(new Date(Date.now() - off * 86400000));
      const [y, m, dd] = d.split("-");
      const nd = await fetchDoc("https://9lotto.com/result/" + y + "-" + Number(m) + "-" + Number(dd));
      if (!nd) continue;
      const ns = parseNineDoc(nd);
      const jp9 = nineJpFromDoc(nd);
      const six = ns ? nineSixFromPrizes(ns.prize) : null;
      const hasAny = (arr?: string[]) => !!arr && arr.some((v) => /^\d{4}$/.test(v));
      const jpRows = (jp9 && jp9.rows) || {};
      const hasJp = !!jp9 && (!!jp9.pool || Object.values(jpRows).some((v) => /\d/.test(v)));
      const hasData = (ns && (hasAny(ns.prize) || hasAny(ns.special) || hasAny(ns.cons))) || (six && six.main && !isDash(six.main)) || hasJp;
      if (hasData) cand.push({ dateLbl: weekdayOf(d), ns, six, jp9 });
    }
    if (!cand.length) return;
    let use = cand[0];
    if (cand.length >= 2) {
      const a = cand[0].six ? cand[0].six.main : "----";
      const b = cand[1].six ? cand[1].six.main : "----";
      // If today has no new draw yet (blank, or identical to yesterday), show yesterday.
      if (isDash(a) || a === b) use = cand[1];
    }
    const { dateLbl, ns, six, jp9 } = use;
    if (nineCard && ns) {
      const dt = nineCard.querySelector('[data-id="date"]');
      if (dt && dt.textContent !== dateLbl) setText(dt, dateLbl);
      if (ns.prize && ns.prize.length) applySet(nineCard, { ...ns, date: dateLbl });
    }
    if (six && six.main && !isDash(six.main)) {
      applySixValues("table-18-2026-09-06-6d", { ...six, date: dateLbl });
    } else {
      applySixValues("table-18-2026-09-06-6d", { main: "----", date: dateLbl });
    }
    if (jp9) {
      const vals: Record<string, string> = {};
      if (jp9.pool) vals.n9_sj_pool = jp9.pool;
      if (jp9.rows) for (const [k, v] of Object.entries(jp9.rows)) if (v) vals[k] = v;
      applyIdValues("table-18-2026-09-06-6d", vals);
    }
  } catch {
    // ignore
  }
}

async function refreshOnce() {
  let path = window.location.pathname;
  // Single-game pages (e.g. /result/magnum) update from the same live sources.
  const gm = /^\/result\/([^/?#]+)/.exec(path);
  if (gm && gameBySlug[gm[1]]) {
    path = gameBySlug[gm[1]].mode === 'home' ? '/' : '/lotto-4d';
  }
  try {
    if (path === "/" || path === "/4dresults" || path === "/4dresults/") {
      await syncLiveTable("https://live4dresult.net/", [
        "table-1", "table-6", "table-4", "table-3", "table-2", "table-7", "table-5", "table-13", "table-17",
      ]);
      await updateGdNineCards();
    } else if (path === "/sabah-sarawak-4d-results") {
      await syncLiveTable("https://live4dresult.net/sabah-sarawak-4d-results/", ["table-8", "table-9", "table-10"]);
    } else if (path === "/singapore-4d-results") {
      await syncLiveTable("https://live4dresult.net/singapore-4d-results/", ["table-11", "table-12"]);
    } else if (path === "/lotto-4d" || path === "/cambodia-4d-results") {
      await syncLiveTable("https://live4dresult.net/lotto-4d/", ["table-13", "table-17"]);
      await updateGdNineCards();
      // Perdana 4D - two draws a day (latest completed date, fallback yesterday)
      for (const [time, id] of [["15:30", "table-16-2026-09-06-1530"], ["19:30", "table-16-2026-09-06-1930"]]) {
        for (const off of [0, -1]) {
          const d = dateStrNoPad(new Date(Date.now() + off * 86400000));
          const pd = await fetchDoc("https://www.perdana4d.com/Results/4D?processDate=" + d);
          if (!pd) continue;
          const mp = parsePerdana(pd);
          const st = mp[time];
          const card = document.getElementById(id);
          if (card && st && st.prize && !st.prize.every(isDash)) { applySet(card, st); break; }
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
            if (card && set && set.prize && !set.prize.every(isDash)) {
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
                    if (nums.length) vals.jp_no = nums.join(" or ");
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
  const [status, setStatus] = useState("…");
  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    const tick = async () => {
      await refreshOnce();
      if (!alive) return;
      setStatus(new Date().toLocaleTimeString());
      timer = window.setTimeout(tick, nextInterval());
    };
    timer = window.setTimeout(tick, 150);
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, []);
  return (
    <div
      style={{
        position: "fixed",
        right: 12,
        bottom: 64,
        zIndex: 9999,
        background: "rgba(22,51,199,0.92)",
        color: "#fff",
        fontSize: 12,
        padding: "4px 10px",
        borderRadius: 12,
        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
        pointerEvents: "none",
      }}
    >
      <span style={{ display: "inline-block", width: 8, height: 8, background: "#6cf46c", borderRadius: 8, marginRight: 6, animation: "blinker 1s linear infinite" }} />
      LIVE · updated {status}
    </div>
  );
}



