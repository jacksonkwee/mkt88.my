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

systemctl stop mkt88-site
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
echo "DEPLOY_OK commit=$commit backup=$backup"
