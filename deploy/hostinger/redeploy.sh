#!/usr/bin/env bash
set -Eeuo pipefail

old=/srv/mkt88-site
stamp="$(date +%Y%m%d%H%M%S)"
next="/srv/mkt88-site-next-${stamp}"
backup="/srv/mkt88-site-prev-${stamp}"
failed="/srv/mkt88-site-failed-${stamp}"
swapfile="/swapfile.mkt88-build"
env_file="/etc/mkt88-site.env"
env_backup=""

# A timer and an owner-initiated deploy must never swap directories at the
# same time. The later caller exits and retries on its next timer tick.
exec 9>/run/lock/mkt88-redeploy.lock
if ! flock -n 9; then
  echo "another MKT88 deployment is already running"
  exit 75
fi

cleanup() {
  if [ -d "$next" ]; then
    rm -rf -- "$next"
  fi
  if swapon --show=NAME --noheadings | grep -q "$swapfile"; then
    swapoff "$swapfile"
  fi
  if [ -f "$swapfile" ]; then
    rm -f -- "$swapfile"
  fi
  if [ -n "$env_backup" ] && [ -f "$env_backup" ]; then
    rm -f -- "$env_backup"
  fi
}
trap cleanup EXIT

test -f "$old/package.json"

# The production VPS has 4 GB RAM. Next's 43-page production build peaks above
# that while all static pages are generated, so use temporary swap only for the
# build. It is released by cleanup() whether deployment succeeds or fails.
if ! swapon --show=NAME --noheadings | grep -q "$swapfile"; then
  fallocate -l 4G "$swapfile"
  chmod 600 "$swapfile"
  mkswap "$swapfile"
  swapon "$swapfile"
fi
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096"
free -h

git clone --depth 1 --branch main \
  https://github.com/jacksonkwee/mkt88.my.git "$next"
commit="$(git -C "$next" rev-parse HEAD)"

mkdir -p "$next/data" "$next/public/uploads"
if [ -d "$old/data" ]; then
  cp -a "$old/data/." "$next/data/"
fi
if [ -d "$old/public/uploads" ]; then
  cp -a "$old/public/uploads/." "$next/public/uploads/"
fi

set -a
. /etc/mkt88-site.env
set +a

cd "$next"
npm install --no-audit --no-fund
MKT88_DEPLOYMENT_BUILD=1 npm run build
chown -R www-data:www-data "$next"
install -d -m 0755 /usr/local/lib/mkt88
install -m 0644 "$next/deploy/hostinger/android-document-proxy.mjs" \
  /usr/local/lib/mkt88/android-document-proxy.mjs
install -m 0644 "$next/deploy/hostinger/mkt88-android-doc.service" \
  /etc/systemd/system/mkt88-android-doc.service
install -m 0755 "$next/deploy/hostinger/mkt88-auto-deploy.sh" \
  /usr/local/sbin/mkt88-auto-deploy
install -m 0644 "$next/deploy/hostinger/mkt88-auto-deploy.service" \
  /etc/systemd/system/mkt88-auto-deploy.service
install -m 0644 "$next/deploy/hostinger/mkt88-auto-deploy.timer" \
  /etc/systemd/system/mkt88-auto-deploy.timer
systemctl daemon-reload

env_backup="$(mktemp)"
cp -a "$env_file" "$env_backup"
if grep -q '^GIT_COMMIT_SHA=' "$env_file"; then
  sed "s/^GIT_COMMIT_SHA=.*/GIT_COMMIT_SHA=${commit}/" "$env_file" > "${env_file}.next"
else
  cp -p "$env_file" "${env_file}.next"
  printf '\nGIT_COMMIT_SHA=%s\n' "$commit" >> "${env_file}.next"
fi
chmod --reference="$env_file" "${env_file}.next"
mv "${env_file}.next" "$env_file"

if ! timeout 20s systemctl stop mkt88-site; then
  systemctl kill --kill-who=main -s KILL mkt88-site || true
  systemctl reset-failed mkt88-site || true
fi
mv "$old" "$backup"
mv "$next" "$old"

if ! systemctl start mkt88-site; then
  mv "$old" "$failed"
  mv "$backup" "$old"
  cp -a "$env_backup" "$env_file"
  systemctl start mkt88-site
  exit 1
fi

ready=0
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/version >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  systemctl stop mkt88-site
  mv "$old" "$failed"
  mv "$backup" "$old"
  cp -a "$env_backup" "$env_file"
  systemctl start mkt88-site
  exit 1
fi

curl -fsS http://127.0.0.1:3000/api/version
echo

# Next streams HTML as chunked responses. Android WebView can leave that
# response in the loading state forever, so send app documents through the
# small proxy that adds a real Content-Length. Restarting Caddy is required
# because its Caddyfile is a file bind mount and the site directory was swapped.
systemctl enable --now mkt88-android-doc.service
systemctl restart mkt88-android-doc.service
systemctl enable --now mkt88-auto-deploy.timer
docker restart mkt88-site-caddy-1 >/dev/null

android_ready=0
for _ in $(seq 1 20); do
  if curl -fsSI -H "User-Agent: MKT88Android" \
    https://www.mkt88.my/result/grand-dragon | grep -qi '^content-length:' \
    && curl -fsSI -H "User-Agent: MKT88Android" \
    https://www.mkt88.my/result/grand-dragon | grep -qi '^alt-svc: clear'; then
    android_ready=1
    break
  fi
  sleep 1
done
if [ "$android_ready" -ne 1 ]; then
  systemctl stop mkt88-site
  mv "$old" "$failed"
  mv "$backup" "$old"
  cp -a "$env_backup" "$env_file"
  systemctl start mkt88-site
  docker restart mkt88-site-caddy-1 >/dev/null
  exit 1
fi

mapfile -t stale_backups < <(
  find /srv -mindepth 1 -maxdepth 1 -type d -name 'mkt88-site-prev-*' \
    -printf '%T@ %p\n' | sort -nr | tail -n +3 | cut -d' ' -f2-
)
if ((${#stale_backups[@]})); then
  rm -rf -- "${stale_backups[@]}"
fi

echo "DEPLOY_OK commit=$commit backup=$backup"
