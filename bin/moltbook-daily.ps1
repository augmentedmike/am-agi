# moltbook-daily.ps1 — calendar-aware daily posting for Am (Windows)
# Reads claim_date from moltbook/agent.json, computes today's day number,
# posts only files scheduled for that day (skipping already-posted ones).
# Usage: moltbook-daily.ps1 [-DryRun]

param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent $ScriptDir
$AgentJson  = Join-Path $RepoRoot "moltbook\agent.json"
$ScheduleJson = Join-Path $RepoRoot "moltbook\post-schedule.json"
$PostLog    = Join-Path $RepoRoot "moltbook\post-log.md"
$PostsDir   = Join-Path $RepoRoot "moltbook\posts"
$PostBin    = Join-Path $ScriptDir "moltbook-post.ps1"

# ── Compute day number ───────────────────────────────────────────────────────
$agent     = Get-Content $AgentJson | ConvertFrom-Json
$claimDate = $agent.claim_date
if (-not $claimDate) {
    Write-Error "claim_date missing from $AgentJson"
    exit 1
}

$today     = (Get-Date).ToUniversalTime().Date
$claim     = [datetime]::ParseExact($claimDate, "yyyy-MM-dd", $null)
$dayNumber = [int](($today - $claim).TotalDays) + 1

$ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
Write-Host "[$ts] Day $dayNumber (claim_date=$claimDate, today=$($today.ToString('yyyy-MM-dd')))"

# ── Load today's schedule ────────────────────────────────────────────────────
$schedule = Get-Content $ScheduleJson | ConvertFrom-Json
$entries  = $schedule."$dayNumber"
if (-not $entries -or $entries.Count -eq 0) {
    Write-Host "No posts scheduled for day $dayNumber."
    exit 0
}
Write-Host "Scheduled posts: $($entries.Count)"

# ── Idempotency: load already-posted filenames ───────────────────────────────
$postedFiles = @()
if (Test-Path $PostLog) {
    $postedFiles = (Get-Content $PostLog) -replace '.*\|.*\|.*\|.*\|.*' | `
        Select-String -Pattern '\d{3}-[\w-]+\.md' | `
        ForEach-Object { $_.Matches[0].Value }
}

# ── Post each entry ──────────────────────────────────────────────────────────
$first = $true
foreach ($entry in $entries) {
    $filename = $entry.filename
    $submolt  = $entry.submolt
    $file     = Join-Path $PostsDir $filename

    if ($postedFiles -contains $filename) {
        Write-Host "  skip (already posted): $filename"
        continue
    }

    if (-not (Test-Path $file)) {
        Write-Host "  skip (file not found): $file"
        continue
    }

    # Extract title from first H1
    $title = (Get-Content $file | Select-String '^# ' | Select-Object -First 1).Line -replace '^# ', ''
    if (-not $title) { $title = $filename }

    # Rate limit
    if (-not $first) {
        Write-Host "  sleeping 155s for rate limit..."
        if (-not $DryRun) { Start-Sleep -Seconds 155 }
    }
    $first = $false

    if ($DryRun) {
        Write-Host "  [dry-run] would post: $filename → $submolt ($title)"
        continue
    }

    Write-Host "  posting: $filename → $submolt"
    $result = & pwsh -File $PostBin --submolt $submolt --title $title --content "@$file" --force
    $postId = ($result | ConvertFrom-Json).id

    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $postNum   = [regex]::Match($filename, '^\d+').Value
    $logLine   = "| $postNum | $title | $($postId ?? 'unknown') | $submolt | $timestamp |"
    Add-Content -Path $PostLog -Value $logLine

    Write-Host "  ✓ posted $filename (id=$postId)"
}

$ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
Write-Host "[$ts] moltbook-daily done."
