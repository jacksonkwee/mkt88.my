const BASE = (process.env.MKT88_BASE || "https://www.mkt88.my").replace(/\/+$/, "");
const CDP = (process.env.CDP_URL || "http://127.0.0.1:9222").replace(/\/+$/, "");

const GAMES = [
  { slug: "magnum", label: "Magnum", table: "table-1" },
  { slug: "damacai", label: "Da Ma Cai", table: "table-4" },
  { slug: "sportstoto", label: "Sports Toto", table: "table-6" },
  { slug: "sg", label: "Singapore", table: "table-11" },
  { slug: "sabah88", label: "Sabah 88", table: "table-10" },
  { slug: "cashsweep", label: "Cash Sweep", table: "table-9" },
  { slug: "sandakan", label: "Sandakan", table: "table-8" },
  { slug: "grand-dragon", label: "Grand Dragon", table: "table-13" },
  { slug: "nine-lotto", label: "Nine Lotto", table: "table-17" },
  { slug: "perdana", label: "Perdana", table: "table-16" },
  { slug: "lucky-harihari", label: "Lucky HariHari", table: "table-15" },
];

const loadLive = async () => (await fetch(BASE + "/api/home-live?manual=" + Date.now(), { cache: "no-store" })).json();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const target = await (await fetch(CDP + "/json/new?about:blank", { method: "PUT" })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve);
  socket.addEventListener("error", reject);
});

let nextId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "evaluation failed");
  return result.result.value;
};

function expectedFor(game, live) {
  const card = live.cards?.[game.table];
  if (card) return card;
  if (game.slug === "perdana") {
    const sets = Object.values(live.perdana || {}).filter(Boolean);
    const set = sets.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0];
    return set ? setToCard(set) : {};
  }
  if (game.slug === "lucky-harihari") {
    const sets = Object.values(live.hari || {}).map((entry) => entry?.set).filter(Boolean);
    const set = sets.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0];
    return set ? setToCard(set) : {};
  }
  return {};
}

function setToCard(set) {
  const card = { date: set.date, draw_no: set.drawNo };
  ["first", "second", "third"].forEach((name, i) => { card[name + "_prize"] = set.prize?.[i]; });
  (set.special || []).forEach((value, i) => { card["special-" + (i + 1)] = value; });
  (set.cons || []).forEach((value, i) => { card["consolation-" + (i + 1)] = value; });
  return card;
}

const isDash = (value) => !value || /^----+$/.test(String(value).trim());
await call("Page.enable");
await call("Runtime.enable");
await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await call("Emulation.setUserAgentOverride", {
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36 MKT88Android",
});

const failures = [];
try {
  await call("Page.navigate", { url: BASE + "/result/magnum" });
  await sleep(2200);
  const slideCount = await evaluate("document.querySelectorAll('.mkt-pager-track > *').length");
  if (slideCount !== 11) failures.push(`pager has ${slideCount} slides, expected 11`);

  for (let i = 0; i < Math.min(slideCount, GAMES.length); i++) {
    const game = GAMES[i];
    const currentLive = await loadLive();
    const before = failures.length;
    const result = await evaluate(`(() => {
      const track=document.querySelector('.mkt-pager-track');
      track.scrollLeft=${i}*track.clientWidth;
      track.dispatchEvent(new Event('scroll'));
      return true;
    })()`);
    if (!result) continue;
    await sleep(4000);
    const check = await evaluate(`(() => {
      const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.right>0&&r.left<innerWidth;};
      const cards=Array.from(document.querySelectorAll('.mkt-pager-track .card.outer-box.${game.table}:not(.mkt-past)')).filter(visible);
      const card=cards[0];
      if(!card)return {ok:false,why:'visible card missing'};
      const get=id=>{const e=card.querySelector('[data-id="'+id+'"]');return e?(e.textContent||'').trim():'';};
      const present=Object.fromEntries(Array.from(card.querySelectorAll('[data-id]')).map(e=>[e.getAttribute('data-id'),true]));
      const shown={date:get('date'),draw_no:get('draw_no'),first_prize:get('first_prize'),second_prize:get('second_prize'),third_prize:get('third_prize')};
      for(let n=1;n<=15;n++)shown['special-'+n]=get('special-'+n);
      for(let n=1;n<=10;n++)shown['consolation-'+n]=get('consolation-'+n);
      return {ok:true,shown,present};
    })()`);
    if (!check.ok) {
      failures.push(`${game.label}: ${check.why}`);
      continue;
    }
    const want = expectedFor(game, currentLive);
    const shown = check.shown;
    if (want.date && shown.date !== want.date) failures.push(`${game.label}: date ${shown.date || "empty"}, expected ${want.date}`);
    if (want.draw_no && shown.draw_no && !/^----+$/.test(want.draw_no) && shown.draw_no !== want.draw_no) {
      failures.push(`${game.label}: draw ${shown.draw_no}, expected ${want.draw_no}`);
    }
    if ((shown.date || "").includes("06-09-2026")) failures.push(`${game.label}: captured 06-09-2026 result is visible`);
    if (want.date && shown.date === want.date) {
      for (const [id, value] of Object.entries(want)) {
        if (id === "date") continue;
        if (!check.present[id] || id === "zodiac") continue;
        if (!isDash(value) && shown[id] !== String(value)) failures.push(`${game.label}: ${id} ${shown[id] || "empty"}, expected ${value}`);
        if (isDash(value) && /^\d{3,6}$/.test(shown[id] || "")) failures.push(`${game.label}: ${id} still shows ${shown[id]}`);
      }
    }
    console.log((failures.length > before ? "CHECK" : "PASS ") + "  " + game.label + "  " + shown.date + " " + (shown.draw_no || ""));
  }
} finally {
  socket.close();
  await fetch(CDP + "/json/close/" + target.id).catch(() => {});
}

if (failures.length) {
  console.error("Live 11-game check failed:");
  for (const failure of failures) console.error(" - " + failure);
  process.exitCode = 1;
} else {
  console.log("All 11 live games match the current snapshot.");
}
