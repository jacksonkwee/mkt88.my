# Keeps the number-history archive and the hot-number statistics current, once a day.
#
# This is the PC's copy of the same work the GitLab schedule does: catch the
# archive up to the last complete draw, extend the Grand Dragon / Nine Lotto /
# HariHari bundles, rebuild the statistics, and publish. Running both means the
# page still moves when one of them does not fire - which is what happened
# between 17 and 19 Oct 2026, when the page sat on 17-10 for two days.
#
# Only the four data files are staged, so the Perdana collector's own changes in
# the working tree are never swept into this commit.
param([int]$Days = 3)

$ErrorActionPreference = "Continue"
$repo = "C:\dev\GONGXIFACAI"
$node = "C:\Users\dabom\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$logDir = "C:\Users\dabom\.codex\visualizations\2026\09\16\01a0a9f3-a4df-7bb3-b56d-ad84ba999132"
$log = Join-Path $logDir ("history-task-" + (Get-Date -Format "yyyyMMdd") + ".log")

function Say($msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Write-Output $line
  Add-Content -LiteralPath $log -Value $line
}

Set-Location $repo
Say "start"

& $node "scripts\refresh-number-history.mjs" 2>&1 | Out-Null
& $node "scripts\build-gd-nine-past.mjs" --days $Days 2>&1 | Out-Null
& $node "scripts\build-hari-past.mjs" --days $Days 2>&1 | Out-Null
& $node "scripts\build-number-stats.mjs" 2>&1 | Out-Null

$files = @(
  "src/components/sites/mkt88/app/number-history-db.json",
  "src/lib/number-stats.json",
  "src/lib/gd-nine-past.json",
  "src/lib/hari-past.json"
)

$gitArgs = @("-c", "safe.directory=C:/dev/GONGXIFACAI")
$changed = & git @gitArgs status --porcelain -- $files
if (-not $changed) {
  Say "already current - nothing to publish"
  exit 0
}

& git @gitArgs add -- $files
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
& git @gitArgs -c user.name="mkt88-results-pc" -c user.email="pc@mkt88.my" commit -q -m "Number history updated $stamp (PC)" 2>&1 | Out-Null

# The GitLab job pushes at the same time of night, so rebase before pushing.
& git @gitArgs pull --rebase --autostash -q origin main 2>&1 | Out-Null
$push = & git @gitArgs push origin main 2>&1
if ($LASTEXITCODE -ne 0) {
  Say "push failed: $push"
  exit 1
}

$latest = (Get-Content "src\lib\number-stats.json" -Raw | ConvertFrom-Json).games |
  Sort-Object { [datetime]$_.to } -Descending | Select-Object -First 1
Say ("published - newest draw in the stats: " + $latest.name + " " + $latest.to)
