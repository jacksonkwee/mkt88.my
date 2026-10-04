# Registers (or refreshes) the "MKT88 Keep Warm" scheduled task.
#
# Run this once on any PC that should keep the site awake:
#   powershell -ExecutionPolicy Bypass -File scripts\install-keep-warm.ps1
#
# It needs no administrator rights and runs as the signed-in user, so it only
# pings while that user is logged on.

$ErrorActionPreference = "Stop"

$taskName = "MKT88 Keep Warm"
$script = Join-Path $PSScriptRoot "keep-warm.ps1"

if (-not (Test-Path -LiteralPath $script)) {
    throw "keep-warm.ps1 not found next to this installer: $script"
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""

$trigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) `
    -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Pings mkt88.my every 5 minutes so the phone app never waits for a cold server." `
    -Force | Out-Null

Write-Host "Registered scheduled task '$taskName' - it runs every 5 minutes while you are signed in."
Write-Host "Last run is written to: $(Join-Path $PSScriptRoot 'keep-warm-last-run.txt')"
