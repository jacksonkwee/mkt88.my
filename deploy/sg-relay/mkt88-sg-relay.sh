#!/usr/bin/env bash
set -u

: "${MKT88_SG_ENDPOINT:?MKT88_SG_ENDPOINT is required}"
: "${MKT88_SG_INGEST_SECRET:?MKT88_SG_INGEST_SECRET is required}"

feed="${MKT88_SG_FEED:-http://cloud.live4d.sg/api/sg4d/jlive}"
interval="${MKT88_SG_INTERVAL:-30}"

while true; do
  payload="$(curl -fsS \
    --connect-timeout 8 \
    --max-time 15 \
    --retry 2 \
    --retry-delay 2 \
    -H 'User-Agent: Mozilla/5.0' \
    -H 'Accept: application/json' \
    -H 'Accept-Encoding: identity' \
    "${feed}?ts=$(date +%s)" 2>/dev/null)" || payload=""

  if [ -n "$payload" ]; then
    if printf '%s' "$payload" | curl -fsS \
      --connect-timeout 8 \
      --max-time 15 \
      -X POST \
      -H "Authorization: Bearer ${MKT88_SG_INGEST_SECRET}" \
      -H 'Content-Type: application/json' \
      --data-binary @- \
      "$MKT88_SG_ENDPOINT" >/dev/null; then
      logger -t mkt88-sg-relay "forwarded feed"
    else
      logger -t mkt88-sg-relay "website POST failed"
    fi
  else
    logger -t mkt88-sg-relay "upstream fetch failed"
  fi

  sleep "$interval"
done
