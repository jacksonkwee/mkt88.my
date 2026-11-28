#!/usr/bin/env bash
set -Eeuo pipefail

remote="${MKT88_REMOTE:-https://github.com/jacksonkwee/mkt88.my.git}"
site="/srv/mkt88-site"
env_file="/etc/mkt88-site.env"

test -d "$site"
test -f "$site/deploy/hostinger/redeploy.sh"
test -f "$env_file"

remote_commit="$(git ls-remote "$remote" refs/heads/main | awk 'NR == 1 { print $1 }')"
if [[ ! "$remote_commit" =~ ^[0-9a-f]{40}$ ]]; then
  logger -t mkt88-auto-deploy "could not read GitHub main"
  exit 1
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
  exit 1
fi

logger -t mkt88-auto-deploy "deployed $remote_commit"
