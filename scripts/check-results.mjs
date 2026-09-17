#!/usr/bin/env node
/**
 * Result smoke checks.
 *
 * Every bug that reached users recently was one of these:
 *   - a card left completely blank (Grand Dragon before its draw was published)
 *   - a card whose date and numbers came from two different draws
 *   - a prize grid whose numbers slid one cell out of line
 *   - a jackpot number that lost its repeated digits
 *   - a feed we could not reach, quietly producing nothing
 *
 * This asks the live site the same questions a visitor would, and fails loudly
 * when an answer is wrong - so the next one is caught here instead of by a user.
 *
 * Usage:
 *   node scripts/check-results.mjs
 *   BASE_URL=http://localhost:8888 node scripts/check-results.mjs
 */

const BASE = (process.env.BASE_URL || "https://www.mkt88.my").replace(/\/$/, "");
const UA = "Mozilla/5.0 (compatible; mkt88-result-check)";

let passes = 0;
const failures = [];

function check(name, ok, detail) {
  if (ok) {
    passes++;
    console.log("  PASS  " + name);
  } else {
    failures.push(name);
    console.log("  FAIL  " + name + (detail ? "  ->  " + detail : ""));
  }
}

function section(title) {
  console.log("\n" + title);
}

/** A cell is "empty" when it is missing, blank, or the ---- placeholder. */
const isDash = (v) => !v || /^----+$/.test(String(v).trim());

/** All values of one grid, by key prefix (special- / consolation-). */
function gridValues(card, prefix) {
  return Object.entries(card || {})
    .filter(([k]) => k.startsWith(prefix))
    .map(([, v]) => String(v).trim())
    .filter((v) => /^\d{1,6}$/.test(v));
}

/** "16-09-2026 (Wed)" -> "2026-09-16". */
function parseLabel(s) {
  const m = /^(\d{2})-(\d{2})-(\d{4})/.exec(String(s || "").trim());
  return m ? m[3] + "-" + m[2] + "-" + m[1] : null;
}

/** Today in Malaysia, whatever timezone this runs in. */
function todayMy() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

async function getJson(path) {
  const res = await fetch(BASE + path, { headers: { "user-agent": UA }, cache: "no-store" });
  if (!res.ok) throw new Error(path + " -> HTTP " + res.status);
  return res.json();
}

async function main() {
  console.log("Checking " + BASE);

  const home = await getJson("/api/home-live");
  const cam = await getJson("/api/cambodia-live");
  const cards = home.cards || {};

  section("Feeds answered");
  check("home feed returned cards", Object.keys(cards).length > 0, Object.keys(cards).length + " card classes");

  section("No result card is blank");
  const blank = Object.entries(cards)
    .filter(([, vals]) => Object.values(vals).every(isDash))
    .map(([cls]) => cls);
  check("every home card carries at least one number", blank.length === 0, blank.join(", "));

  // NOTE: a prize grid MAY repeat a number - the official Magnum Special grid
  // prints 6144 twice - so "duplicate value" is not an error and is not tested
  // here. The bug where the numbers slid one cell out of line left the same
  // values in a different order, which this data-level check cannot see at all.
  // Catching that needs a browser watching the DOM, and is a separate check.
  section("Prize grids are populated");
  const thin = Object.entries(cards)
    .filter(([, vals]) => gridValues(vals, "special-").length + gridValues(vals, "consolation-").length === 0)
    .map(([cls]) => cls);
  check("every prize grid carries numbers", thin.length === 0, thin.join(", "));

  section("Magnum Jackpot Gold digits are intact");
  const t2 = cards["table-2"] || {};
  const slots = ["number_1", "number_2", "number_3", "number_4", "number_5", "number_6", "number_7", "number_8", "number_9"]
    .map((k) => String(t2[k] === undefined ? "" : t2[k]).trim());
  check("all nine slots are filled", slots.every((d) => d !== ""), JSON.stringify(slots));
  check("the separator sits in slot 7", slots[6] === "+", 'slot 7 = "' + slots[6] + '"');

  section("Grand Dragon shows a complete, correctly dated draw");
  const gd6 = cam.gd6;
  const gdjp7 = cam.gdjp7 || {};
  const gdMain = gd6 && gd6.main ? gd6.main : "";
  check("6D result present", /^\d{6}$/.test(gdMain), JSON.stringify(gd6));
  check("6+1D jackpot present", !isDash(gdjp7.jp7_grand), JSON.stringify(gdjp7.jp7_grand || ""));
  check("jackpot pool present", !isDash(gdjp7.jp7_pool), JSON.stringify(gdjp7.jp7_pool || ""));
  check("6+1D is the 6D plus one digit", !!gdMain && String(gdjp7.jp7_grand || "").startsWith(gdMain + " + "),
    "6D=" + gdMain + " 6+1D=" + (gdjp7.jp7_grand || ""));

  const gdDate = parseLabel(gd6 && gd6.date);
  const fourDDate = parseLabel((cards["table-13"] || {}).date);
  check("Grand Dragon date matches the draw its numbers came from",
    !!gdDate && gdDate === fourDDate,
    "6D date=" + (gdDate || String(gd6 && gd6.date)) + "  4D date=" + (fourDDate || String((cards["table-13"] || {}).date)));

  if (gdDate) {
    const age = daysBetween(gdDate, todayMy());
    check("Grand Dragon draw is recent and not in the future", age >= 0 && age <= 3,
      "draw " + gdDate + " is " + age + " day(s) from today (" + todayMy() + ")");
  } else {
    check("Grand Dragon carries a draw date", false, "no parsable date: " + JSON.stringify(gd6 && gd6.date));
  }

  section("Nine Lotto");
  check("6D result present", !!(cam.nine6 && /^\d{6}$/.test(cam.nine6.main || "")), JSON.stringify(cam.nine6));

  console.log("\n" + passes + " passed, " + failures.length + " failed");
  if (failures.length) {
    console.log("Failures:");
    for (const f of failures) console.log("  - " + f);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\nCHECK ERROR: " + e.message);
  process.exit(1);
});
