import { sendLiveCheckAlert } from "./live-check-alert.mjs";

const BASE = (process.env.LIVE_BASE_URL || "https://www.mkt88.my").replace(/\/+$/, "");
const args = process.argv.slice(2);
const expectedCommit = args.includes("--expect-commit")
  ? args[args.indexOf("--expect-commit") + 1]
  : "";
const waitMs = Number(process.env.LIVE_DEPLOY_WAIT_MS || 8 * 60_000);

let errors = [];
const dash = (value) => !value || /^----+$/.test(String(value).trim());

async function request(path) {
  const response = await fetch(BASE + path, {
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  const text = await response.text();
  return { response, text };
}

async function waitForDeployment() {
  if (!expectedCommit) return;
  const deadline = Date.now() + waitMs;
  let last = "not checked";
  while (Date.now() < deadline) {
    try {
      const { response, text } = await request("/api/version");
      if (response.ok) {
        const version = JSON.parse(text);
        last = version.commit || "empty commit";
        if (version.commit === expectedCommit) {
          console.log(`Deployment ${expectedCommit.slice(0, 7)} is live.`);
          return;
        }
      } else {
        last = `HTTP ${response.status}`;
      }
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`Deployment ${expectedCommit} did not become live within ${Math.round(waitMs / 1000)}s (last: ${last})`);
}

function shownValue(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(escaped + String.raw`</div>\s*<div class="h[45] mb-0">([^<]*)</div>`).exec(html);
  return match?.[1]?.trim() || "";
}

function powerNumbers(html) {
  return [...html.matchAll(/class="border rounded text-center py-3 h4 mb-0">([^<]*)<\/div>/g)]
    .slice(0, 6)
    .map((match) => match[1].trim());
}

function checkDynamic(label, response) {
  if (response.headers.get("x-nextjs-prerender")) {
    errors.push(`${label} is still prerendered (x-nextjs-prerender: ${response.headers.get("x-nextjs-prerender")})`);
  }
}

function compare(label, pageValue, apiValue) {
  if (dash(apiValue)) return;
  if (dash(pageValue)) {
    errors.push(`${label}: API has ${apiValue}, page shows ${pageValue || "nothing"}`);
  } else if (pageValue !== apiValue) {
    errors.push(`${label}: page ${pageValue} does not match API ${apiValue}`);
  }
}

async function notifyFailure(title, details) {
  const result = await sendLiveCheckAlert({
    title,
    details,
    base: BASE,
    commit: expectedCommit,
  });
  if (!result.configured) {
    console.log("No alert channel configured; failure is recorded in the GitLab job.");
    return;
  }
  if (result.failures.length) {
    console.error("Alert delivery failed:");
    for (const failure of result.failures) console.error(" - " + failure);
  } else {
    console.log(`Failure alert sent to ${result.sent} channel(s).`);
  }
}

async function checkOnce() {
  errors = [];
  const before = JSON.parse((await request("/api/home-live")).text);
  const magnumPage = await request("/result/magnum-4d-jackpot");
  const powerPage = await request("/result/power-toto");
  const magnumGamePage = await request("/result/magnum");
  const sportsTotoPage = await request("/result/sportstoto");
  const homePage = await request("/");
  const sitemap = await request("/sitemap.xml");
  const sourceHealth = await request("/api/source-health?summary=1");
  const after = JSON.parse((await request("/api/home-live")).text);

  for (const [label, result] of [
    ["Magnum page", magnumPage],
    ["Power Toto page", powerPage],
    ["Magnum game page", magnumGamePage],
    ["Sports Toto page", sportsTotoPage],
    ["home page", homePage],
    ["sitemap", sitemap],
    ["source health", sourceHealth],
  ]) {
    if (!result.response.ok) errors.push(`${label} returned HTTP ${result.response.status}`);
  }

  checkDynamic("Magnum page", magnumPage.response);
  checkDynamic("Power Toto page", powerPage.response);

  const magnum = after.cards?.["table-1"] || before.cards?.["table-1"] || {};
  compare("Magnum Jackpot 1", shownValue(magnumPage.text, "Magnum 4D Jackpot 1"), magnum.first_jackpot_prize);
  compare("Magnum Jackpot 2", shownValue(magnumPage.text, "Magnum 4D Jackpot 2"), magnum.second_jackpot_prize);
  const gold = after.cards?.["table-2"] || before.cards?.["table-2"] || {};
  compare("Jackpot Gold 1", shownValue(magnumPage.text, "4D Jackpot Gold 1"), gold.first_jackpot_prize);
  compare("Jackpot Gold 2", shownValue(magnumPage.text, "4D Jackpot Gold 2"), gold.second_jackpot_prize);

  const toto = after.cards?.["table-7"] || before.cards?.["table-7"] || {};
  const shownPowerNumbers = powerNumbers(powerPage.text);
  for (let i = 1; i <= 6; i++) {
    compare(`Power Toto number ${i}`, shownPowerNumbers[i - 1], toto[`power_toto_number_${i}`]);
  }
  compare("Power Toto jackpot", shownValue(powerPage.text, "Power Toto 6/55 Jackpot"), toto.power_toto_first_jackpot_prize);

  if (!magnumPage.text.includes('<link rel="canonical" href="https://www.mkt88.my/result/magnum-4d-jackpot"')) {
    errors.push("Magnum page canonical is missing");
  }
  if (!powerPage.text.includes('<link rel="canonical" href="https://www.mkt88.my/result/power-toto"')) {
    errors.push("Power Toto page canonical is missing");
  }
  if (!magnumPage.text.includes("application/ld+json") || !powerPage.text.includes("application/ld+json")) {
    errors.push("A jackpot page is missing JSON-LD");
  }
  const expectedDate = String(toto.date || "").slice(0, 10);
  const powerTitle = /<title>(.*?)<\/title>/.exec(powerPage.text)?.[1] || "";
  if (expectedDate && !powerTitle.includes(expectedDate)) {
    errors.push(`Power Toto title is missing the latest draw date ${expectedDate}`);
  }
  if (!powerPage.text.includes("Power Toto 6/55 FAQ") || !powerPage.text.includes('"FAQPage"')) {
    errors.push("Power Toto FAQ content or structured data is missing");
  }
  if (!magnumPage.text.includes("Magnum 4D Jackpot FAQ") || !magnumPage.text.includes('"FAQPage"')) {
    errors.push("Magnum Jackpot FAQ content or structured data is missing");
  }
  if (!sportsTotoPage.text.includes('href="/result/power-toto"')) {
    errors.push("Sports Toto page is missing the Power Toto internal link");
  }
  const expectedMagnumDate = String(gold.date || magnum.date || "").slice(0, 10);
  const magnumTitle = /<title>(.*?)<\/title>/.exec(magnumPage.text)?.[1] || "";
  if (expectedMagnumDate && !magnumTitle.includes(expectedMagnumDate)) {
    errors.push(`Magnum Jackpot title is missing the latest draw date ${expectedMagnumDate}`);
  }
  if (!magnumGamePage.text.includes('href="/result/magnum-4d-jackpot"')) {
    errors.push("Magnum page is missing the Magnum Jackpot internal link");
  }
  if (!homePage.text.includes('href="/result/magnum-4d-jackpot"')
    || !homePage.text.includes('href="/result/power-toto"')) {
    errors.push("Home page is missing one or both jackpot internal links");
  }
  if (!magnumPage.text.includes('href="/past-results"')
    || !powerPage.text.includes('href="/past-results"')) {
    errors.push("A jackpot page is missing the past-results link");
  }
  if (!magnumPage.text.includes('href="/result/power-toto"')
    || !powerPage.text.includes('href="/result/magnum-4d-jackpot"')) {
    errors.push("The jackpot pages are missing their cross-links");
  }
  if (sourceHealth.response.ok) {
    try {
      const health = JSON.parse(sourceHealth.text);
      for (const source of health.bad || []) {
        errors.push(`Data source ${source.source}: ${source.why || "unhealthy"}`);
      }
    } catch {
      errors.push("Source-health response is not valid JSON");
    }
  }
  if (!sitemap.text.includes("/result/magnum-4d-jackpot")) errors.push("sitemap is missing /result/magnum-4d-jackpot");
  if (!sitemap.text.includes("/result/power-toto")) errors.push("sitemap is missing /result/power-toto");
}

if (args.includes("--test-alert")) {
  const result = await sendLiveCheckAlert({
    title: "Notification test",
    details: "Manual test from scripts/check-live-pages.mjs.",
    base: BASE,
    commit: expectedCommit,
  });
  if (!result.configured) {
    console.error("No alert channel configured. Set ALERT_WEBHOOK_URL or TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.");
    process.exit(1);
  }
  if (result.failures.length) {
    for (const failure of result.failures) console.error(" - " + failure);
    process.exit(1);
  }
  console.log(`Test alert sent to ${result.sent} channel(s).`);
  process.exit(0);
}

try {
  await waitForDeployment();
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      await checkOnce();
    } catch (error) {
      errors = [error instanceof Error ? error.message : String(error)];
    }
    if (!errors.length) break;
    if (attempt < 6) {
      console.log(`Attempt ${attempt} not ready: ${errors.join("; ")}`);
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
  if (errors.length) {
    console.error("Live jackpot checks failed:");
    for (const error of errors) console.error(" - " + error);
    await notifyFailure("Live jackpot checks failed", errors.join("\n"));
    process.exit(1);
  }
  console.log("Live jackpot checks passed.");
} catch (error) {
  const details = error instanceof Error ? error.message : String(error);
  console.error(details);
  await notifyFailure("Deployment verification failed", details);
  process.exit(1);
}
