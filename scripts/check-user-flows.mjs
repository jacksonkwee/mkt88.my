// User-flow smoke test through a real Chrome instance.
//
// Start Chrome with:
//   chrome --headless=new --remote-debugging-port=9222 --remote-allow-origins=*
// Then run:
//   node scripts/check-user-flows.mjs
const BASE = (process.env.MKT88_BASE || "https://www.mkt88.my").replace(/\/+$/, "");
const CDP = (process.env.CDP_URL || "http://127.0.0.1:9222").replace(/\/+$/, "");
const TODAY = "2026-11-08";
const PAST_DATE = "2026-11-04";

const GAMES = [
  { slug: "magnum", label: "Magnum", href: "/result/magnum", table: "table-1" },
  { slug: "damacai", label: "Da Ma Cai", href: "/result/damacai", table: "table-4" },
  { slug: "sportstoto", label: "Sports Toto", href: "/result/sportstoto", table: "table-6", extraTable: "table-7" },
  { slug: "sg", label: "Singapore", href: "/singapore-4d-results", table: "table-11" },
  { slug: "sabah88", label: "Sabah 88", href: "/sabah-sarawak-4d-results?op=sabah88", table: "table-10" },
  { slug: "cashsweep", label: "Cash Sweep", href: "/sabah-sarawak-4d-results?op=cashsweep", table: "table-9" },
  { slug: "sandakan", label: "Sandakan", href: "/sabah-sarawak-4d-results?op=sandakan", table: "table-8" },
  { slug: "grand-dragon", label: "Grand Dragon", href: "/result/grand-dragon", table: "table-13", kh: true },
  { slug: "nine-lotto", label: "Nine Lotto", href: "/result/nine-lotto", table: "table-17", kh: true },
  { slug: "perdana", label: "Perdana", href: "/result/perdana", table: "table-16", kh: true },
  { slug: "lucky-harihari", label: "Lucky HariHari", href: "/result/lucky-harihari", table: "table-15", kh: true },
];

const target = await (await fetch(CDP + "/json/new?about:blank", { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();
const sameOriginFailures = [];
const pageErrors = [];
const requests = [];
let currentPath = "/";

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
    return;
  }
  if (message.method === "Network.requestWillBeSent") requests.push(message.params.request.url);
  if (message.method === "Network.responseReceived") {
    const { url, status } = message.params.response;
    if (url.startsWith(BASE) && status >= 400) sameOriginFailures.push(`${status} ${url}`);
  }
  if (message.method === "Runtime.exceptionThrown") {
    pageErrors.push({
      path: currentPath,
      text: message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text || "page exception",
    });
  }
};
await new Promise((resolve) => { ws.onopen = resolve; });

const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  const timer = setTimeout(() => {
    pending.delete(id);
    reject(new Error(`CDP timeout: ${method}`));
  }, 30_000);
  pending.set(id, {
    resolve: (value) => { clearTimeout(timer); resolve(value); },
    reject: (error) => { clearTimeout(timer); reject(error); },
  });
  ws.send(JSON.stringify({ id, method, params }));
});

async function evaluate(expression) {
  const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "evaluation failed");
  }
  return result.result.value;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(expression, timeout = 15_000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await evaluate(expression)) return;
    await sleep(200);
  }
  throw new Error("Timed out waiting for: " + expression);
}

async function goto(path) {
  currentPath = path;
  await call("Page.navigate", { url: BASE + path });
  await waitFor("document.body !== null && (document.readyState !== 'loading' || (document.body.innerText || '').trim().length > 20)");
  await sleep(700);
}

const visibleCheck = "e => { const r=e.getBoundingClientRect(); return r.width>0 && r.height>0 && r.right>0 && r.left<innerWidth; }";

async function clickVisible(selector, contains = "") {
  const text = JSON.stringify(contains);
  return evaluate(`(() => {
    const visible = (${visibleCheck});
    const el = Array.from(document.querySelectorAll(${JSON.stringify(selector)}))
      .find(e => visible(e) && (!${text} || (e.innerText || "").includes(${text})));
    if (!el) return false;
    el.scrollIntoView({block:"center", inline:"center"});
    el.click();
    return true;
  })()`);
}

async function clickLink(href, scope = "") {
  return evaluate(`(() => {
    const visible = (${visibleCheck});
    const root = ${scope ? `document.querySelector(${JSON.stringify(scope)})` : "document"};
    const el = Array.from((root || document).querySelectorAll("a[href]"))
      .find(a => a.getAttribute("href") === ${JSON.stringify(href)} && visible(a));
    if (!el) return false;
    el.click();
    return true;
  })()`);
}

async function visiblePastCards() {
  return evaluate(`(() => {
    const visible = (${visibleCheck});
    return Array.from(document.querySelectorAll(".card.outer-box.mkt-past"))
      .filter(visible)
      .map(e => ({
        cls: e.className,
        id: e.id,
        text: (e.innerText || "").replace(/\\s+/g, " ").slice(0, 350)
      }));
  })()`);
}

async function chooseHistoryDate(date) {
  await waitFor(`Array.from(document.querySelectorAll(".mkt-past-filter-title")).some(${visibleCheck})`, 15_000);
  let opened = false;
  for (let attempt = 0; attempt < 3 && !opened; attempt++) {
    if (!await clickVisible(".mkt-past-filter-title")) throw new Error("Past-result filter button not found");
    try {
      await waitFor(`Array.from(document.querySelectorAll(".mkt-past-filter-select")).some(${visibleCheck})`, 3_000);
      opened = true;
    } catch {
      await sleep(400);
    }
  }
  if (!opened) throw new Error("Past-result filter did not open");
  const changed = await evaluate(`(() => {
    const visible = (${visibleCheck});
    const select = Array.from(document.querySelectorAll(".mkt-past-filter-select")).find(${visibleCheck});
    if (!select) return false;
    if (!Array.from(select.options).some(o => o.value === ${JSON.stringify(date)})) return false;
    select.value = ${JSON.stringify(date)};
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  if (!changed) throw new Error("Past date not available: " + date);
  await waitFor("document.querySelector('.mkt-past-scope.mkt-past-on') !== null", 10_000);
  await waitFor("!document.body.innerText.includes('Loading past result')", 20_000);
}

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

try {
  let expected = {};
  try {
    const live = await (await fetch(BASE + "/api/home-live", { cache: "no-store" })).json();
    expected = Object.fromEntries(GAMES.map((game) => [game.slug, live?.cards?.[game.table]?.first_prize || ""]));
  } catch { /* the page checks below still have to prove the rendered data */ }

  await call("Page.enable");
  await call("Runtime.enable");
  await call("Network.enable");
  await call("Network.setBypassServiceWorker", { bypass: true });
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const mobileUserAgent = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36 MKT88Android";
  await call("Emulation.setUserAgentOverride", { userAgent: mobileUserAgent });
  await call("Network.setUserAgentOverride", { userAgent: mobileUserAgent });

  await goto("/");
  try {
    await waitFor("Array.from(document.querySelectorAll('.mkt-app-home a[href]')).filter(a => /^\\/result\\/|^\\/singapore-4d-results|^\\/sabah-sarawak/.test(a.getAttribute('href') || '')).length === 11");
  } catch {
    const home = await evaluate(`({
      url: location.href,
      text: (document.body.innerText || "").slice(0, 800),
      links: Array.from(document.querySelectorAll("a")).map(a => a.getAttribute("href")).filter(Boolean).slice(0, 30)
    })`);
    throw new Error("App home did not show 11 games: " + JSON.stringify(home));
  }
  record("App 首頁顯示 11 個遊戲", true);

  for (const game of GAMES) {
    if (!await clickLink(game.href, ".mkt-app-home")) throw new Error("Cannot tap home tile " + game.label);
    await waitFor(`location.pathname + location.search === ${JSON.stringify(game.href)}`, 15_000);
    currentPath = game.href;
    await waitFor(`Array.from(document.querySelectorAll(".card.outer-box:not(.mkt-past)")).some(${visibleCheck})`, 15_000);
    await waitFor(`Array.from(document.querySelectorAll(".card.outer-box:not(.mkt-past)")).some(e => (${visibleCheck})(e) && !(e.innerText || "").includes("06-09-2026"))`, 15_000);
    const wantFirst = expected[game.slug];
    if (/^\d{4}$/.test(wantFirst || "")) {
      await waitFor(`Array.from(document.querySelectorAll(".card.outer-box.${game.table}:not(.mkt-past)")).some(e => (${visibleCheck})(e) && (e.innerText || "").includes(${JSON.stringify(wantFirst)}))`, 15_000);
    }
    // The result markup is server-rendered before React attaches the history
    // controls. Give hydration a moment before exercising that control.
    await sleep(1_500);
    const loaded = await evaluate(`(() => {
      const visible = (${visibleCheck});
      const card = Array.from(document.querySelectorAll(".card.outer-box:not(.mkt-past)")).find(visible);
      return card ? (card.innerText || "").replace(/\\s+/g," ").slice(0,240) : "";
    })()`);
    record(`首頁點擊 ${game.label}`, /Date:|Draw No:/.test(loaded), loaded.slice(0, 100));

    await chooseHistoryDate(PAST_DATE);
    const cards = await visiblePastCards();
    const hasMain = cards.some((card) => card.cls.includes(game.table));
    const hasExtra = !game.extraTable || cards.some((card) => card.cls.includes(game.extraTable));
    const hasFirst = cards.some((card) => /1st|1st Prize|首奖/.test(card.text));
    record(`${game.label} ${PAST_DATE} 歷史`, hasMain && hasExtra && hasFirst, `${cards.length} cards`);
    if (game.slug === "sportstoto") {
      record("Sports Toto 5D/6D/Lotto 歷史", cards.some((card) => card.cls.includes("table-7") && /5D/.test(card.text) && /Star Toto 6\/50/.test(card.text)));
    }
    await goto("/");
  }

  await goto("/result/sportstoto");
  await waitFor(`Array.from(document.querySelectorAll(".mkt-pager-track")).some(${visibleCheck})`, 15_000);
  const pathBefore = await evaluate("location.pathname + location.search");
  requests.length = 0;
  await evaluate(`(() => {
    window.__mktSpinSeen = false;
    window.__mktSpinObserver?.disconnect();
    window.__mktSpinObserver = new MutationObserver(() => {
      if (Array.from(document.querySelectorAll(".mkt-spin")).some(${visibleCheck})) window.__mktSpinSeen = true;
    });
    window.__mktSpinObserver.observe(document.body, { childList: true, subtree: true });
  })()`);
  const activeLogo = await evaluate(`(() => {
    const tile = document.querySelector('a[aria-current="page"][href="/result/sportstoto"]');
    if (!tile) return false;
    tile.click();
    return true;
  })()`);
  if (!activeLogo) throw new Error("Current Sports Toto logo not found");
  await sleep(300);
  const spinner = await evaluate("window.__mktSpinSeen === true");
  await waitFor(`Array.from(document.querySelectorAll(".mkt-spin")).every(e => !(${visibleCheck})(e))`, 15_000);
  const manual = requests.some((url) => url.includes("/api/home-live?manual="));
  record("點目前遊戲 logo 自動刷新", spinner && manual && await evaluate("location.pathname + location.search") === pathBefore, `spinner=${spinner}, manual=${manual}`);

  await goto("/");
  await waitFor("document.querySelectorAll('.mkt-app-home a[href]').length >= 11", 15_000);
  const openAction = async (label) => evaluate(`(() => {
    const el = Array.from(document.querySelectorAll(".mkt-app-home a")).find(a => (a.innerText || "").includes(${JSON.stringify(label)}));
    if (!el) return false;
    el.click();
    return true;
  })()`);
  if (!await openAction("Lucky Number")) throw new Error("Lucky Number tile not found");
  await waitFor("document.body.innerText.includes('恭喜发财')", 5_000);
  record("Lucky Number 彈窗", true);
  await clickVisible("button", "Close");
  if (!await openAction("Settings")) throw new Error("Settings tile not found");
  await waitFor("document.body.innerText.includes('管理员登入 / Admin')", 5_000);
  const switches = await evaluate("document.querySelectorAll('[role=switch]').length");
  record("Settings 彈窗", switches >= 2, `switches=${switches}`);
  await clickVisible("button", "Done");

  const seeLiveClicked = await evaluate(`(() => {
    const button = document.querySelector(".mkt-app-home button.mkt-press");
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!seeLiveClicked) throw new Error("See live results button not found");
  await waitFor("location.pathname === '/4dresults'", 15_000);
  record("See live results 按鈕", true);

  await goto("/past-results");
  await waitFor("document.querySelectorAll('.card.outer-box.mkt-past').length > 0", 15_000);
  record("過去開彩首頁有卡片", true, String(await evaluate("document.querySelectorAll('.card.outer-box.mkt-past').length")));

  await goto("/past-results/" + PAST_DATE);
  await waitFor("document.querySelectorAll('.card.outer-box').length >= 8", 15_000);
  record("過去開彩完整日期頁", true, String(await evaluate("document.querySelectorAll('.card.outer-box').length")));

  for (const page of [
    ["/number-history?num=2734", "Number History"],
    ["/favourites", "Favourite Numbers"],
    ["/dabogong", "DABOGONG Number Chart"],
    ["/statistics", "Hot Numbers"],
    ["/draw-schedule", "Draw Schedule"],
    ["/result/power-toto", "Power Toto"],
    ["/result/star-toto", "Star Toto"],
    ["/result/supreme-toto", "Supreme Toto"],
    ["/result/magnum-4d-jackpot", "Magnum 4D Jackpot"],
    ["/about", "About"],
    ["/contact", "Contact"],
    ["/privacy-policy", "Privacy Policy"],
    ["/terms", "Terms"],
  ]) {
    await goto(page[0]);
    await waitFor("document.body.innerText.length > 100", 15_000);
    const bad = await evaluate("/could not load|application error|something went wrong/i.test(document.body.innerText)");
    record(page[1] + " 頁面", !bad);
  }

  const meaningfulErrors = pageErrors.filter((error) => !/ResizeObserver|favicon|AbortError/i.test(error.text));
  record("瀏覽期間無頁面例外", meaningfulErrors.length === 0, meaningfulErrors.slice(0, 2).map((e) => `${e.path}: ${e.text}`).join(" | "));
  const unexpectedFailures = sameOriginFailures.filter((failure) => !failure.includes("/api/live?u="));
  record("本站 API 無非預期 4xx/5xx", unexpectedFailures.length === 0, unexpectedFailures.slice(0, 3).join(" | "));
} catch (error) {
  record("測試流程", false, error.message);
} finally {
  const failed = results.filter((result) => !result.ok);
  console.log(JSON.stringify({ base: BASE, checkedAt: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length }, null, 2));
  ws.close();
  await fetch(CDP + "/json/close/" + target.id).catch(() => {});
  if (failed.length) process.exitCode = 1;
}
