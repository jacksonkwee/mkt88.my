"use client";

import { useEffect, useState } from "react";

/**
 * LiveResults - polls the original sources through the server proxy and
 * updates the rendered tables in place (no page reload):
 *  - live4dresult.net pages: synced cell-by-cell via data-id attributes
 *  - Perdana 4D: two draws/day from perdana4d.com
 *  - Lucky HariHari: two draws/day from api.hari4d.com
 */

const INTERVAL = 60000;

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
    const ids = [...target.querySelectorAll("[data-id]")].map((x) => x.getAttribute("data-id") || "");
    for (const id of ids) {
      const srcEl = srcCard.querySelector('[data-id="' + id + '"]');
      const tgtEl = target.querySelector('[data-id="' + id + '"]');
      if (!srcEl || !tgtEl) continue;
      const v = (srcEl.textContent || "").trim();
      const cur = (tgtEl.textContent || "").trim();
      if (!v) continue;
      if (isDash(v) && !isDash(cur)) continue;
      if (v !== cur) setText(tgtEl, v);
    }
    flash(target);
  }
}

function flash(card: Element) {
  card.classList.add("live-flash");
  setTimeout(() => card.classList.remove("live-flash"), 900);
}

function applySet(card: Element, s: PrizeSet) {
  if (!s || !s.prize || s.prize.length === 0) return;
  if (s.prize.every(isDash)) return; // draw not available yet
  const tables = [...card.querySelectorAll("table")];
  const prizeRows = tables[0] ? [...tables[0].querySelectorAll("tr")] : [];
  s.prize.forEach((v, i) => {
    const row = prizeRows[i];
    const cell = row ? row.querySelector("td.lottery-prize-number") : null;
    if (cell && !isDash(v)) setText(cell, v);
  });
  const specialCells = tables[1] ? [...tables[1].querySelectorAll("td.lottery-number")] : [];
  s.special.forEach((v, i) => {
    const cell = specialCells[i];
    if (cell && !isDash(v)) setText(cell, v);
  });
  if (specialCells.length > s.special.length) {
    for (let i = s.special.length; i < specialCells.length; i++) {
      if (specialCells[i]) (specialCells[i] as HTMLElement).innerHTML = "&nbsp;";
    }
  }
  const consCells = tables[2] ? [...tables[2].querySelectorAll("td.lottery-number")] : [];
  s.cons.forEach((v, i) => {
    const cell = consCells[i];
    if (cell && !isDash(v)) setText(cell, v);
  });
  if (s.date) {
    const dt = card.querySelector('[data-id="date"]');
    if (dt) setText(dt, s.date);
  }
  if (s.drawNo) {
    const dn = card.querySelector('[data-id="draw_no"]');
    if (dn) setText(dn, s.drawNo);
  }
  flash(card);
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
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function refreshOnce() {
  const path = window.location.pathname;
  try {
    if (path === "/") {
      await syncLiveTable("https://live4dresult.net/", [
        "table-1", "table-6", "table-4", "table-3", "table-2", "table-7", "table-5", "table-13", "table-17",
      ]);
    } else if (path === "/sabah-sarawak-4d-results") {
      await syncLiveTable("https://live4dresult.net/sabah-sarawak-4d-results/", ["table-8", "table-9", "table-10"]);
    } else if (path === "/singapore-4d-results") {
      await syncLiveTable("https://live4dresult.net/singapore-4d-results/", ["table-11", "table-12"]);
    } else if (path === "/lotto-4d" || path === "/cambodia-4d-results") {
      await syncLiveTable("https://live4dresult.net/lotto-4d/", ["table-13", "table-17"]);
      // Perdana 4D - two draws a day
      const pd = await fetchDoc("https://www.perdana4d.com/Results/4D?processDate=" + dateStrNoPad(new Date()));
      if (pd) {
        const map = parsePerdana(pd);
        const c15 = document.getElementById("table-16-2026-09-06-1530");
        const c19 = document.getElementById("table-16-2026-09-06-1930");
        if (c15 && map["15:30"]) applySet(c15, map["15:30"]);
        if (c19 && map["19:30"]) applySet(c19, map["19:30"]);
      }
      // Lucky HariHari - two draws a day (JSON API)
      const today = dateStrNoPad(new Date());
      const slots: Array<[string, string]> = [
        ["15:30", "table-15-2026-09-06-1530"],
        ["19:30", "table-15-2026-09-06-1930"],
      ];
      for (const [time, id] of slots) {
        const txt = await fetchText(`https://api.hari4d.com/DrawResultL/GetDrawResult?date=${today}T${time}:00`);
        if (!txt) continue;
        try {
          const json = JSON.parse(txt);
          const card = document.getElementById(id);
          const set = hariSetFromJson(json);
          if (card && set) applySet(card, set);
        } catch {
          // ignore
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
    const tick = async () => {
      await refreshOnce();
      if (alive) setStatus(new Date().toLocaleTimeString());
    };
    const id = window.setTimeout(tick, 900);
    const iv = window.setInterval(tick, INTERVAL);
    return () => {
      alive = false;
      window.clearTimeout(id);
      window.clearInterval(iv);
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
