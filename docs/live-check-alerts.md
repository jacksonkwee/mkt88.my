# Live-page failure alerts

The `live-pages` GitLab job checks the deployed jackpot pages after each push to
`main`. When the check still fails after its cold-start retries, it can send the
error details to a webhook and/or Telegram.

Configure at least one channel in
**GitLab -> Settings -> CI/CD -> Variables**. Mark secrets as **Masked**; use
**Protected** if the production branch is protected.

## Webhook

Use an incoming webhook from Slack, Discord or Google Chat.

```text
ALERT_WEBHOOK_URL=https://...
```

Optional bearer token:

```text
ALERT_WEBHOOK_TOKEN=...
```

The request sends a JSON body containing both `text` and `content` so the same
webhook works with the common Slack, Discord and Google Chat formats.

## Telegram

1. Open `@BotFather` in Telegram and create a bot with `/newbot`.
2. Save the bot token.
3. Send a message to the bot, then call
   `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy the target chat ID.
4. Add both variables in GitLab:

```text
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

## Test the notification

With the variables set locally:

```bash
node scripts/check-live-pages.mjs --test-alert
```

Or run the `live-pages` job manually after adding the variables.

If no channel is configured, the GitLab job still fails normally and prints a
warning that no external alert was sent.
