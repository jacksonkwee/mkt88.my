# Keeps the bundled past results current, once a day.
#
# Grand Dragon, Nine Lotto and Lucky HariHari past dates are served from copies
# inside the app (see build-gd-nine-past.mjs / build-hari-past.mjs). This adds
# the newest day to those copies and publishes them so the next deploy carries
# them - which is what keeps a fresh date opening instantly.
param([int]$Days = 3)

$ErrorActionPreference = "Continue"
$repo = "C:\dev\GONGXIFACAI"
$node = "C:\Users\dabom\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
Set-Location $repo

& $node "scripts\build-gd-nine-past.mjs" --days $Days 2>&1 | Out-Null
& $node "scripts\build-hari-past.mjs" --days $Days 2>&1 | Out-Null

$changed = git status --porcelain -- src/lib/gd-nine-past.json src/lib/hari-past.json
if (-not $changed) {
  Write-Output "past bundles already current - nothing to publish"
  exit 0
}

git add -- src/lib/gd-nine-past.json src/lib/hari-past.json
git commit -q -m "Daily past-result bundle update"
git push -q origin main
Write-Output "published: $changed"