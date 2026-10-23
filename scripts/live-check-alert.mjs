const MAX_MESSAGE = 3500;

function message({ title, details, base, commit }) {
  const lines = [
    `MKT88 alert: ${title}`,
    `Site: ${base}`,
    `Commit: ${commit || "not specified"}`,
    `Time: ${new Date().toISOString()}`,
    "",
    details,
  ];
  return lines.join("\n").slice(0, MAX_MESSAGE);
}

async function post(label, url, init) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
}

/**
 * Send a failed live-page check to whichever alert channels are configured.
 * Slack, Discord and Google Chat accept one of the two fields below; Telegram
 * uses its own Bot API.
 */
export async function sendLiveCheckAlert({
  title,
  details,
  base = "https://www.mkt88.my",
  commit = "",
}) {
  const text = message({ title, details, base, commit });
  const webhook = process.env.ALERT_WEBHOOK_URL;
  const webhookToken = process.env.ALERT_WEBHOOK_TOKEN;
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChat = process.env.TELEGRAM_CHAT_ID;
  const telegramConfigured = Boolean(telegramToken && telegramChat);
  const telegramPartial = Boolean(telegramToken) !== Boolean(telegramChat);
  const configured = Boolean(webhook || telegramConfigured || telegramPartial);
  const deliveries = [];
  const failures = [];

  if (telegramPartial) {
    failures.push("Telegram needs both TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID");
  }

  if (webhook) {
    deliveries.push(post("Webhook", webhook, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(webhookToken ? { authorization: `Bearer ${webhookToken}` } : {}),
      },
      body: JSON.stringify({ text, content: text }),
    }).catch((error) => {
      failures.push(error instanceof Error ? error.message : String(error));
    }));
  }

  if (telegramConfigured) {
    deliveries.push(post(
      "Telegram",
      `https://api.telegram.org/bot${telegramToken}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChat,
          text: text.slice(0, 3900),
          disable_web_page_preview: true,
        }),
      }
    ).catch((error) => {
      failures.push(error instanceof Error ? error.message : String(error));
    }));
  }

  await Promise.all(deliveries);
  return {
    configured,
    sent: Math.max(0, deliveries.length - failures.length),
    failures,
  };
}
