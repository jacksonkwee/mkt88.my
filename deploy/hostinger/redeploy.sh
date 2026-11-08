#!/usr/bin/env bash
set -Eeuo pipefail

old=/srv/mkt88-site
stamp="$(date +%Y%m%d%H%M%S)"
next="/srv/mkt88-site-next-${stamp}"
backup="/srv/mkt88-site-prev-${stamp}"
failed="/srv/mkt88-site-failed-${stamp}"

cleanup() {
  if [ -d "$next" ]; then
    rm -rf -- "$next"
  fi
}
trap cleanup ERR

test -f "$old/package.json"
git clone --depth 1 --branch main \
  https://github.com/jacksonkwee/mkt88.my.git "$next"

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
npm run build
chown -R www-data:www-data "$next"

systemctl stop mkt88-site
mv "$old" "$backup"
mv "$next" "$old"

if ! systemctl start mkt88-site; then
  mv "$old" "$failed"
  mv "$backup" "$old"
  systemctl start mkt88-site
  exit 1
fi

sleep 3
if ! curl -fsS http://127.0.0.1:3000/api/health; then
  systemctl stop mkt88-site
  mv "$old" "$failed"
  mv "$backup" "$old"
  systemctl start mkt88-site
  exit 1
fi

echo
echo "DEPLOY_OK backup=$backup"
