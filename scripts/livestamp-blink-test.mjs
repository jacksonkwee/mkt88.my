/*
 * End-to-end check of the blink fix on a Lucky HariHari card.
 *
 * The phone's own read of the operator is stubbed to publish a draw; the
 * server copy the page polls every second is stubbed to be OLDER and to know
 * nothing about those numbers, which is exactly the situation that made a
 * result number blink. The numbers must stay on the card.
 *
 * Run the dev server on 8889 first.
 */
import { createRequire } from "node:module";
// The browser lives in the Codex runtime, not in this project's node_modules.
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = "http://localhost:8889";
const UA = "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

const LETTERS = "ABCDEFGHIJKLM";
const CONS = "NOPQRSTUVW";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());   // YYYY-MM-DD

// What the phone reads from the operator: today's 7:30pm HariHari draw.
const OPERATOR = { id: 9911, drawDate: today + "T19:30:00", prize1: "1234", prize2: "5678", prize3: "9012" };
LETTERS.split("").forEach((L, i) => { OPERATOR["prize" + L] = String(1100 + i); });
CONS.split("").forEach((L, i) => { OPERATOR["prize" + L] = String(2200 + i); });
OPERATOR.prize1From = "A"; OPERATOR.prize2From = "B"; OPERATOR.prize3From = "C";

// The server copy the page polls: 30 seconds old, same date, but it has none of
// those numbers - only one special, so its board counts as "started".
const staleAt = Date.now() - 30000;
const staleHari = {
  set: {
    prize: ["----", "----", "----"],
    special: ARRAY15(),
    cons: Array(10).fill("----"),
    date: OPERATOR_DATE_LABEL(),
    drawNo: "9911",
  },
  six: null,
  jp: null,
};
function ARRAY15() { const a = Array(15).fill("----"); a[0] = "1100"; return a; }
function OPERATOR_DATE_LABEL() {
  const [y, m, d] = today.split("-");
  const wk = new Date(today + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
  return d + "-" + m + "-" + y + " (" + wk + ")";
}

(async () => {
  const b = await chromium.launch({ channel: "msedge" });
  const ctx = await b.newContext({ viewport: { width: 390, height: 860 }, userAgent: UA });
  await ctx.route("**/api/cambodia-live", (route) =>
    route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ at: staleAt, date: today, perdana: { "15:30": null, "19:30": null },
        hari: { "15:30": null, "19:30": staleHari }, gd6: null, gdjp7: null, nine6: null, nineJp: null }) }));
  // The phone reads api.hari4d.com directly when it can (it is in DIRECT_HOSTS),
  // and only falls back to our proxy - so both have to be answered.
  const hariStub = (route) => {
    const u = decodeURIComponent(route.request().url());
    if (u.includes("api.hari4d.com") && u.includes("DrawResultL")) {
      console.log("STUB hari DrawResultL -> " + OPERATOR.prize1);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(OPERATOR) });
    }
    if (u.includes("api.hari4d.com") && u.includes("GetJackpot")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ jackpotAmount: null }) });
    }
    return route.continue();
  };
  await ctx.route("**/api/live**", hariStub);
  await ctx.route("**api.hari4d.com**", hariStub);
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    window.__log = [];
    const start = () => {
      const card = document.getElementById("table-15-2026-09-06-1930");
      if (!card) return false;
      const cells = [...card.querySelectorAll("td.lottery-prize-number")].slice(0, 3);
      const dateCell = card.querySelector('[data-id="date"]');
      if (dateCell) cells.push(dateCell);
      if (!cells.length) return false;
      cells.forEach((el, i) => {
        if (el.getAttribute("dw")) return;
        el.setAttribute("dw", "1");
        const rec = () => window.__log.push([Math.round(performance.now()), i, (el.textContent || "").trim(), el.getAttribute("data-live-at") ? "stamped" : ""]);
        rec();
        new MutationObserver(rec).observe(el, { childList: true, characterData: true, subtree: true });
      });
      return true;
    };
    const boot = () => { if (!start() && document.documentElement) new MutationObserver(start).observe(document.documentElement, { childList: true, subtree: true }); };
    if (document.documentElement) boot(); else document.addEventListener("readystatechange", boot);
  });
  await p.goto(BASE + "/result/lucky-harihari", { waitUntil: "networkidle", timeout: 120000 });
  const read = () => p.evaluate(() => {
    const c = [...document.querySelectorAll(".card.outer-box.table-15")].find((x) => x.id.endsWith("-1930") && x.getBoundingClientRect().width > 0);
    const g = (id) => { const e = c && c.querySelector('[data-id="' + id + '"]'); return e ? (e.textContent || "").trim() : "(none)"; }
    const rows = c ? [...c.querySelectorAll("td.lottery-prize-number")].slice(0, 3).map((td) => (td.textContent || "").trim()) : [];
    return { id: c ? c.id : "(card not found)", date: g("date"), p1: rows[0], p2: rows[1], p3: rows[2] };
  });
  const seen = [];
  for (let i = 0; i < 14; i++) { await p.waitForTimeout(1500); seen.push(await read()); }
  console.log("card: " + JSON.stringify(seen[0]));
  const log = await p.evaluate(() => window.__log || []);
  console.log("cell writes: " + log.map((r) => r[0] + "ms#" + r[1] + "=" + JSON.stringify(r[2]) + (r[3] ? " " + r[3] : "")).join(" | "));
  const shown = seen.map((r, i) => (i + 1) * 1.5 + "s=" + r.p1 + "/" + r.p2 + "/" + r.p3);
  console.log("1st/2nd/3rd over time: " + shown.join("  "));
  const got = seen[seen.length - 1];
  const ok = got.p1 === "1234" && got.p2 === "5678" && got.p3 === "9012";
  const everBlank = seen.some((r) => !r.p1 || r.p1 === "----");
  console.log(ok && !everBlank ? "PASS - the operator's numbers stayed on the card" : "FAIL - they were blanked or never appeared");
  await b.close();
})();
