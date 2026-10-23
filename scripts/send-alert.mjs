import { sendLiveCheckAlert } from "./live-check-alert.mjs";

const [title = "MKT88 job failed", ...detailParts] = process.argv.slice(2);
const details = detailParts.join(" ") || "No additional details were provided.";
const result = await sendLiveCheckAlert({
  title,
  details,
  base: process.env.LIVE_BASE_URL || "https://www.mkt88.my",
  commit: process.env.CI_COMMIT_SHA || "",
});

if (!result.configured) {
  console.log("No alert channel configured; failure remains visible in the GitLab job.");
} else if (result.failures.length) {
  console.error("Alert delivery failed:");
  for (const failure of result.failures) console.error(" - " + failure);
} else {
  console.log(`Failure alert sent to ${result.sent} channel(s).`);
}
