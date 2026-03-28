# collect-training-data.ps1 — extract shipped AM tasks as ShareGPT JSONL training data (Windows)
param(
  [string]$Output = "dataset\am-tasks.jsonl",
  [int]$MinDiffLines = 5
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$BoardDir = Join-Path $RepoRoot "board"
$MemoryStDir = Join-Path $RepoRoot "workspaces\memory\st"

function Build-SystemPrompt {
  $kb = ""
  if (Test-Path $MemoryStDir) {
    Get-ChildItem -Path $MemoryStDir -Filter "*.md" | ForEach-Object {
      $kb += (Get-Content $_.FullName -Raw) + "`n`n"
    }
  }
  if (-not $kb) {
    $kb = "You are AM, a skilled software engineer. Write clean, well-tested code."
  }
  return $kb
}

function Get-PromptHash([string]$text) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $hash = $sha.ComputeHash($bytes)
  return [BitConverter]::ToString($hash).Replace("-", "").Substring(0, 16).ToLower()
}

function ConvertTo-JsonString([string]$s) {
  return ($s | ConvertTo-Json -Compress)
}

$outputDir = Split-Path -Parent $Output
if ($outputDir -and -not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$systemPrompt = Build-SystemPrompt
$seenHashes = @{}
$count = 0
$skippedDup = 0
$skippedNoDiff = 0
$totalResponseLen = 0

Write-Host "Scanning shipped board cards..." -ForegroundColor Cyan

$cardFiles = @()
if (Test-Path $BoardDir) {
  $cardFiles += Get-ChildItem -Path $BoardDir -Filter "*.qmd" -Recurse |
    Where-Object { $_.FullName -notlike "*\archive\*" }
  $archiveDir = Join-Path $BoardDir "archive"
  if (Test-Path $archiveDir) {
    $cardFiles += Get-ChildItem -Path $archiveDir -Filter "*.qmd"
  }
}

foreach ($cardFile in $cardFiles) {
  $content = Get-Content $cardFile.FullName -Raw
  if ($content -notmatch "^state: shipped") { continue }

  $cardId = $cardFile.BaseName
  if ($content -match "^title: (.+)$") {
    $title = $Matches[1].Trim()
  } else { continue }

  $criteriaFile = Join-Path $RepoRoot "workspaces\cards\$cardId\criteria.md"
  if (Test-Path $criteriaFile) {
    $humanPrompt = "$title`n`n$(Get-Content $criteriaFile -Raw)"
  } else {
    $humanPrompt = $title
  }

  $promptHash = Get-PromptHash $humanPrompt
  if ($seenHashes.ContainsKey($promptHash)) {
    $skippedDup++
    continue
  }
  $seenHashes[$promptHash] = $true

  $gptResponse = ""
  if ($content -match "## Work Log\r?\n(.+)") {
    $gptResponse = $Matches[1].Trim()
  }

  if ($gptResponse.Length -lt $MinDiffLines) {
    $skippedNoDiff++
    continue
  }

  $sysJson = ConvertTo-JsonString $systemPrompt
  $humanJson = ConvertTo-JsonString $humanPrompt
  $gptJson = ConvertTo-JsonString $gptResponse

  $record = "{`"conversations`":[{`"from`":`"system`",`"value`":$sysJson},{`"from`":`"human`",`"value`":$humanJson},{`"from`":`"gpt`",`"value`":$gptJson}]}"
  Add-Content -Path $Output -Value $record -Encoding UTF8

  $totalResponseLen += $gptResponse.Length
  $count++
}

$avgLen = if ($count -gt 0) { [int]($totalResponseLen / $count) } else { 0 }

Write-Host ""
Write-Host "=== Training Data Collection Summary ===" -ForegroundColor Green
Write-Host "Unique prompts written : $count"
Write-Host "Duplicates skipped     : $skippedDup"
Write-Host "Too short skipped      : $skippedNoDiff"
Write-Host "Avg response length    : $avgLen chars"
Write-Host "Output                 : $Output"
