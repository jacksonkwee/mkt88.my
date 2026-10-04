# Keeps the MKT88 site awake so the phone app never waits for a cold server.
#
# Every page is a serverless function that goes to sleep after a spell with no
# visitors, and the first visitor then waits 4-6 seconds while it starts up
# (measured 4 Oct 2026). This nudges the pages the app opens first.
#
# It used to run on GitHub Actions (see .github/workflows/keep-warm.yml), which
# stopped when the GitHub account was suspended, so it now runs from the PC's
# Task Scheduler instead.
#
# Registered as the scheduled task "MKT88 Keep Warm" - see scripts\install-keep-warm.ps1

$ErrorActionPreference = "SilentlyContinue"

$urls = @(
    "https://www.mkt88.my/",
    "https://www.mkt88.my/api/home-live",
    "https://www.mkt88.my/api/cambodia-live",
    "https://www.mkt88.my/result/magnum"
)

foreach ($u in $urls) {
    try {
        Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 30 -Headers @{ "Cache-Control" = "no-cache" } | Out-Null
    } catch {
        # A failed nudge is harmless - the next run tries again.
    }
}

Set-Content -LiteralPath (Join-Path $PSScriptRoot "keep-warm-last-run.txt") -Value (Get-Date -Format "yyyy-MM-dd HH:mm:ss") -Encoding ascii
