#!/usr/bin/env bash
set -u

failures=0

while true; do
  if curl -fsS --max-time 8 http://127.0.0.1:3000/api/health >/dev/null; then
    failures=0
  else
    failures=$((failures + 1))
    logger -t mkt88-health-watch "health check failed (${failures}/2)"
    if [ "$failures" -ge 2 ]; then
      logger -t mkt88-health-watch "restarting stalled mkt88-site service"
      systemctl restart mkt88-site.service || true
      failures=0
      sleep 10
    fi
  fi
  sleep 30
done
