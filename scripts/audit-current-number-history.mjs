const BASE = (process.env.MKT88_BASE || "https://www.mkt88.my").replace(/\/$/, "");
const PRIZES = ["1st", "2nd", "3rd", "Special", "Consolation"];

const isFour = (value) => /^\d{4}$/.test(String(value || "").trim());
const isoOf = (label) => {
  const match = /(\d{2})-(\d{2})-(\d{4})/.exec(label || "");
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
};

function prizeRows(card) {
  if (!card) return [];
  const rows = [];
  for (const [key, value] of Object.entries(card)) {
    if (!isFour(value)) continue;
    let prize = "";
    if (key === "first_prize") prize = "1st";
    else if (key === "second_prize") prize = "2nd";
    else if (key === "third_prize") prize = "3rd";
    else if (/^special-(?:[1-9]|1[0-5])$/.test(key)) prize = "Special";
    else if (/^consolation-(?:\d|10)$/.test(key)) prize = "Consolation";
    else continue;
    rows.push({ prize, num: String(value).trim() });
  }
  return rows;
}

function setRows(set) {
  if (!set) return [];
  return [
    ...((set.prize || []).slice(0, 3).map((num, index) => ({ prize: PRIZES[index], num }))),
    ...((set.special || []).map((num) => ({ prize: "Special", num }))),
    ...((set.cons || []).map((num) => ({ prize: "Consolation", num }))),
  ].filter((row) => isFour(row.num));
}

function expandRows(body) {
  if (Array.isArray(body.matches)) return body.matches;
  const games = body.dict?.games || {};
  const regions = body.dict?.regions || {};
  const prizes = body.dict?.prizes || {};
  return (body.rows || []).map((row) => ({
    date: isoOf(row.d),
    game: games[row.g] || "",
    region: regions[row.r] || "",
    prize: prizes[row.p] || "",
    num: row.n,
  }));
}

async function historyFor(nums) {
  const out = [];
  const unique = [...new Set(nums)];
  for (let i = 0; i < unique.length; i += 60) {
    const batch = unique.slice(i, i + 60);
    const response = await fetch(`${BASE}/api/number-history?nums=${batch.join(",")}&audit=${Date.now()}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`history API returned ${response.status}`);
    out.push(...expandRows(await response.json()));
  }
  return out;
}

async function main() {
  const stamp = Date.now();
  const [homeResponse, cambodiaResponse] = await Promise.all([
    fetch(`${BASE}/api/home-live?audit=${stamp}`, { cache: "no-store" }),
    fetch(`${BASE}/api/cambodia-live?audit=${stamp}`, { cache: "no-store" }),
  ]);
  if (!homeResponse.ok || !cambodiaResponse.ok) throw new Error("live result API unavailable");
  const home = await homeResponse.json();
  const cambodia = await cambodiaResponse.json();

  const games = [
    { game: "Magnum 4D", re: /magnum 4d/i, cards: [home.cards?.["table-1"]] },
    { game: "Da Ma Cai", re: /da ma cai/i, cards: [home.cards?.["table-4"]] },
    { game: "Sports Toto", re: /sportstoto|sports ?toto/i, cards: [home.cards?.["table-6"]] },
    { game: "Singapore 4D", re: /singapore/i, cards: [home.cards?.["table-11"]] },
    { game: "Sandakan 4D", re: /sandakan/i, cards: [home.cards?.["table-8"]] },
    { game: "Cash Sweep", re: /cash\s*sweep/i, cards: [home.cards?.["table-9"]] },
    { game: "Sabah 88", re: /sabah/i, cards: [home.cards?.["table-10"]] },
    { game: "Grand Dragon", re: /grand dragon/i, cards: [home.cards?.["table-13"]] },
    { game: "Nine Lotto", re: /nine lotto/i, cards: [home.cards?.["table-17"]] },
    { game: "Perdana", re: /perdana/i, sets: Object.values(cambodia.perdana || {}) },
    { game: "Lucky HariHari", re: /hari\s*hari/i, sets: Object.values(cambodia.hari || {}).map((entry) => entry?.set) },
  ];

  let total = 0;
  let missing = 0;
  for (const game of games) {
    const expected = [];
    for (const card of game.cards || []) {
      const date = isoOf(card?.date);
      if (!date) continue;
      for (const row of prizeRows(card)) expected.push({ date, ...row });
    }
    for (const set of game.sets || []) {
      const date = isoOf(set?.date);
      if (!date) continue;
      for (const row of setRows(set)) expected.push({ date, ...row });
    }

    const uniqueExpected = [...new Map(expected.map((row) => [`${row.date}|${row.prize}|${row.num}`, row])).values()];
    if (!uniqueExpected.length) {
      console.log(`${game.game}: no current 4D result`);
      continue;
    }
    const found = await historyFor(uniqueExpected.map((row) => row.num));
    const misses = [];
    for (const row of uniqueExpected) {
      total++;
      const ok = found.some((hit) =>
        hit.date === row.date &&
        hit.prize === row.prize &&
        hit.num === row.num &&
        game.re.test(hit.game || "")
      );
      if (!ok) misses.push(row);
    }
    missing += misses.length;
    console.log(`${game.game}: ${uniqueExpected.length - misses.length}/${uniqueExpected.length} present`);
    for (const row of misses) console.log(`  MISSING ${row.date} ${row.prize} ${row.num}`);
  }
  console.log(`TOTAL: ${total - missing}/${total} present, ${missing} missing`);
  if (missing) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
