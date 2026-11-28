#!/usr/bin/env bash
set -Eeuo pipefail

remote="${MKT88_REMOTE:-https://github.com/jacksonkwee/mkt88.my.git}"
site="/srv/mkt88-site"
env_file="/etc/mkt88-site.env"

test -d "$site"
test -f "$site/deploy/hostinger/redeploy.sh"
test -f "$env_file"

alert_failure() {
  status=$?
  logger -t mkt88-auto-deploy "deployment failed with status $status"
  if [ -f "$site/scripts/send-alert.mjs" ]; then
    node "$site/scripts/send-alert.mjs" \
      "MKT88 automatic deployment failed" \
      "Auto-deploy exited with status $status for ${remote_commit:-unknown}" || true
  fi
  exit "$status"
}
trap alert_failure ERR

remote_commit="$(git ls-remote "$remote" refs/heads/main | awk 'NR == 1 { print $1 }')"
if [[ ! "$remote_commit" =~ ^[0-9a-f]{40}$ ]]; then
  false
fi

current_commit="$(sed -n 's/^GIT_COMMIT_SHA=//p' "$env_file" | tail -n 1)"
if [ "$current_commit" = "$remote_commit" ]; then
  exit 0
fi

logger -t mkt88-auto-deploy "deploying ${current_commit:-unknown} -> $remote_commit"
bash "$site/deploy/hostinger/redeploy.sh"

deployed_commit="$(sed -n 's/^GIT_COMMIT_SHA=//p' "$env_file" | tail -n 1)"
if [ "$deployed_commit" != "$remote_commit" ]; then
  logger -t mkt88-auto-deploy "deployment finished at $deployed_commit, expected $remote_commit"
  false
fi

logger -t mkt88-auto-deploy "deployed $remote_commit"
