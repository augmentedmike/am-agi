# moltbook-job-watch.ps1 — scan Moltbook for SWE job postings and email Mike
# Usage: .\moltbook-job-watch.ps1 [--dry-run]

param([switch]$DryRun)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$StateFile = Join-Path $RepoRoot "moltbook\job-scan-state.json"
$Base = "https://www.moltbook.com/api/v1"
$ResendUrl = "https://api.resend.com/emails"
$NotifyEmail = "augmentedmike@gmail.com"
$FromEmail = "am@helloam.bot"
$MaxSeen = 500

$JobKeywords = @(
  "hiring", "we're hiring", "looking for", "job opening",
  "software engineer", "developer role", "backend engineer",
  "frontend engineer", "full stack", "engineering position",
  "apply now", "join our team", "recruiting", "open role", "SWE"
)

if ($DryRun) {
  Write-Host "[dry-run] Would search Moltbook for these job keywords:"
  foreach ($kw in $JobKeywords) { Write-Host "  - $kw" }
  Write-Host "[dry-run] Would notify: $NotifyEmail"
  Write-Host "[dry-run] State file: $StateFile"
  exit 0
}

function Get-VaultKey($Key) {
  $result = & vault get $Key 2>$null
  if ($LASTEXITCODE -ne 0) { throw "vault key not found: $Key" }
  return $result.Trim()
}

$MoltbookKey = Get-VaultKey "MOLTBOOK_API_KEY"
$ResendKey = Get-VaultKey "RESEND_API_KEY"

# Load state
if (-not (Test-Path $StateFile)) {
  '{"seenPostIds":[],"lastScanAt":null}' | Set-Content $StateFile
}
$State = Get-Content $StateFile | ConvertFrom-Json
$SeenIds = [System.Collections.Generic.HashSet[string]]::new($State.seenPostIds)

$Timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$NewIds = [System.Collections.Generic.List[string]]::new()
$Found = 0

Write-Host "[$Timestamp] Scanning Moltbook for SWE job posts..."

$SearchQueries = @(
  "hiring software engineer",
  "looking for developer",
  "engineering position",
  "join our team agent",
  "open role developer"
)

$ProcessedIds = [System.Collections.Generic.HashSet[string]]::new()

foreach ($query in $SearchQueries) {
  Write-Host "  searching: $query"
  $encoded = [Uri]::EscapeDataString($query)
  try {
    $Headers = @{ "Authorization" = "Bearer $MoltbookKey" }
    $Response = Invoke-RestMethod -Uri "$Base/search?q=$encoded&limit=25" -Headers $Headers -ErrorAction SilentlyContinue
  } catch {
    $Response = $null
  }

  $Posts = if ($Response.posts) { $Response.posts } elseif ($Response -is [array]) { $Response } else { @() }

  foreach ($post in $Posts) {
    $PostId = $post.id
    if (-not $PostId) { continue }
    if ($ProcessedIds.Contains($PostId)) { continue }
    [void]$ProcessedIds.Add($PostId)
    if ($SeenIds.Contains($PostId)) { continue }

    $Title = if ($post.title) { $post.title } else { "untitled" }
    $Author = if ($post.author.username) { $post.author.username } elseif ($post.username) { $post.username } else { "unknown" }
    $Submolt = if ($post.submolt) { $post.submolt } else { "general" }
    $Content = if ($post.content) { $post.content.Substring(0, [Math]::Min(300, $post.content.Length)) } else { "" }
    $Combined = "$Title $Content".ToLower()

    $IsJob = $false
    foreach ($kw in $JobKeywords) {
      if ($Combined.Contains($kw.ToLower())) { $IsJob = $true; break }
    }
    if (-not $IsJob) { continue }

    Write-Host "  found job post: $Title (by $Author)"
    $Url = "https://www.moltbook.com/post/$PostId"
    $Body = "New software engineering job on Moltbook:`n`nTitle: $Title`nAuthor: $Author`nSubmolt: m/$Submolt`nURL: $Url`n`n---`n$Content`n---`n`nSent by Am (moltbook-job-watch)"

    $EmailPayload = @{
      from = $FromEmail
      to = @($NotifyEmail)
      subject = "Moltbook job: $Title"
      text = $Body
    } | ConvertTo-Json

    try {
      Invoke-RestMethod -Uri $ResendUrl -Method POST `
        -Headers @{ "Authorization" = "Bearer $ResendKey"; "Content-Type" = "application/json" } `
        -Body $EmailPayload | Out-Null
      Write-Host "  emailed: $Title"
    } catch {
      Write-Warning "  email failed for: $Title"
    }

    [void]$NewIds.Add($PostId)
    $Found++
  }

  Start-Sleep -Seconds 2
}

# Update state
$AllIds = [System.Collections.Generic.List[string]]::new($State.seenPostIds)
foreach ($id in $NewIds) { $AllIds.Add($id) }
$Unique = $AllIds | Select-Object -Unique
if ($Unique.Count -gt $MaxSeen) { $Unique = $Unique | Select-Object -Last $MaxSeen }

$State.seenPostIds = $Unique
$State.lastScanAt = $Timestamp
$State | ConvertTo-Json -Depth 5 | Set-Content $StateFile

Write-Host "[$Timestamp] Done. Found $Found new job posts."
