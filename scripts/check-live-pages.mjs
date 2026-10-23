const BASE = (process.env.LIVE_BASE_URL || "https://www.mkt88.my").replace(/\/+$/, "");
const args = process.argv.slice(2);
const expectedCommit = args.includes("--expect-commit")
  ? args[args.indexOf("--expect-commit") + 1]
  : "";
const waitMs = Number(process.env.LIVE_DEPLOY_WAIT_MS || 8 * 60_000);

const errors = [];
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

try {
  await waitForDeployment();

  const before = JSON.parse((await request("/api/home-live")).text);
  const magnumPage = await request("/result/magnum-4d-jackpot");
  const powerPage = await request("/result/power-toto");
  const sitemap = await request("/sitemap.xml");
  const after = JSON.parse((await request("/api/home-live")).text);

  for (const [label, result] of [
    ["Magnum page", magnumPage],
    ["Power Toto page", powerPage],
    ["sitemap", sitemap],
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
  if (!sitemap.text.includes("/result/magnum-4d-jackpot")) errors.push("sitemap is missing /result/magnum-4d-jackpot");
  if (!sitemap.text.includes("/result/power-toto")) errors.push("sitemap is missing /result/power-toto");

  if (errors.length) {
    console.error("Live jackpot checks failed:");
    for (const error of errors) console.error(" - " + error);
    process.exit(1);
  }
  console.log("Live jackpot checks passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
