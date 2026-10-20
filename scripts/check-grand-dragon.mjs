import { JACKPOT_LETTERS, nextJackpotLetter } from "../src/lib/jackpot-letter.mjs";

const base = (process.argv[2] || process.env.GD_BASE_URL || "http://127.0.0.1:8888").replace(/\/+$/, "");
const url = base + "/result/grand-dragon?verify=" + Date.now();

for (let i = 0; i < JACKPOT_LETTERS.length; i++) {
  const current = JACKPOT_LETTERS[i];
  const expected = JACKPOT_LETTERS[(i + 1) % JACKPOT_LETTERS.length];
  const actual = nextJackpotLetter(current + " : 1234");
  if (actual !== expected) throw new Error(`Jackpot letter cycle failed: ${current} -> ${actual}, expected ${expected}`);
}
if (nextJackpotLetter("E") !== "F" || nextJackpotLetter("M") !== "A") {
  throw new Error("Jackpot letter rollover failed");
}

const response = await fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1",
  },
  cache: "no-store",
});
if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
const html = await response.text();

function cell(id) {
  const match = new RegExp(`<td[^>]*data-id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/td>`, "i").exec(html);
  return match
    ? match[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim()
    : "";
}

const pool = cell("jp4_pool");
const letter = cell("jp4_letter");
const units = cell("jp4_units");
if (!/\d/.test(pool) || /^----+$/.test(pool)) throw new Error(`Grand Dragon Jackpot Pool is blank: "${pool}"`);
if (!/^[A-M]$/.test(letter)) throw new Error(`Grand Dragon Jackpot Letter is invalid: "${letter}"`);
if (!/^\d+$/.test(units)) throw new Error(`Grand Dragon Winning Units is invalid: "${units}"`);

console.log(`Grand Dragon page OK: pool=${pool} letter=${letter} units=${units}`);
