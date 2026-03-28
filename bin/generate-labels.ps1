# generate-labels.ps1 — Windows counterpart to bin/generate-labels
# Calls Claude API on collected prompts, writes teacher-labeled JSONL
param(
    [string]$Input = "dataset\am-tasks.jsonl",
    [string]$Output = "dataset\am-tasks-labeled.jsonl",
    [string]$Model = "claude-3-5-sonnet-20241022",
    [int]$MaxTokens = 4096,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$MemoryStDir = Join-Path $RepoRoot "workspaces\memory\st"

if (-not $env:ANTHROPIC_API_KEY) {
    Write-Error "ANTHROPIC_API_KEY is not set"
    exit 1
}

if (-not (Test-Path $Input)) {
    Write-Error "Input file not found: $Input`nRun: bin\collect-training-data --output $Input"
    exit 1
}

# Build system prompt from AM KB
$SystemPrompt = ""
if (Test-Path $MemoryStDir) {
    Get-ChildItem -Path $MemoryStDir -Filter "*.md" | ForEach-Object {
        $SystemPrompt += (Get-Content $_.FullName -Raw) + "`n`n"
    }
}
if (-not $SystemPrompt) {
    $SystemPrompt = "You are AM, a skilled software engineer. Write clean, well-tested, maintainable code."
}
# Trim to ~4000 chars
if ($SystemPrompt.Length -gt 4000) { $SystemPrompt = $SystemPrompt.Substring(0, 4000) }

function ConvertTo-JsonString([string]$s) {
    return ($s | ConvertTo-Json -Compress)
}

$OutputDir = Split-Path -Parent $Output
if ($OutputDir -and -not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$Lines = Get-Content $Input
$Total = $Lines.Count
$Labeled = 0
$Failed = 0

Write-Host "Loading prompts from: $Input" -ForegroundColor Cyan
Write-Host "Total prompts: $Total" -ForegroundColor Cyan

if ($DryRun) {
    $First = $Lines[0] | ConvertFrom-Json
    $Human = ($First.conversations | Where-Object { $_.from -eq "human" })[0].value
    Write-Host "`n=== DRY RUN — first prompt ===" -ForegroundColor Yellow
    Write-Host $Human.Substring(0, [Math]::Min(500, $Human.Length))
    Write-Host "`nSYSTEM PROMPT (first 300 chars):" -ForegroundColor Yellow
    Write-Host $SystemPrompt.Substring(0, [Math]::Min(300, $SystemPrompt.Length))
    exit 0
}

$SystemJson = ConvertTo-JsonString $SystemPrompt
$Headers = @{
    "x-api-key"         = $env:ANTHROPIC_API_KEY
    "anthropic-version" = "2023-06-01"
    "content-type"      = "application/json"
}

foreach ($Line in $Lines) {
    if (-not $Line.Trim()) { continue }

    $Record = $Line | ConvertFrom-Json
    $HumanPrompt = ($Record.conversations | Where-Object { $_.from -eq "human" })[0].value
    if (-not $HumanPrompt) { continue }

    $HumanJson = ConvertTo-JsonString $HumanPrompt

    $Body = @{
        model      = $Model
        max_tokens = $MaxTokens
        system     = $SystemPrompt
        messages   = @(@{ role = "user"; content = $HumanPrompt })
    } | ConvertTo-Json -Depth 10 -Compress

    try {
        $Response = Invoke-RestMethod -Uri "https://api.anthropic.com/v1/messages" `
            -Method POST -Headers $Headers -Body $Body
        $TeacherResponse = $Response.content[0].text
    } catch {
        $Failed++
        Write-Warning "API call failed: $_"
        continue
    }

    if (-not $TeacherResponse) {
        $Failed++
        Write-Warning "Empty response (skipped)"
        continue
    }

    $GptJson = ConvertTo-JsonString $TeacherResponse

    $OutRecord = "{`"conversations`":[{`"from`":`"system`",`"value`":$SystemJson},{`"from`":`"human`",`"value`":$HumanJson},{`"from`":`"gpt`",`"value`":$GptJson}]}"
    Add-Content -Path $Output -Value $OutRecord

    $Labeled++
    Write-Host "  [$Labeled/$Total] labeled"
}

Write-Host ""
Write-Host "=== Teacher Labeling Summary ===" -ForegroundColor Green
Write-Host "Input prompts  : $Total"
Write-Host "Labeled        : $Labeled"
Write-Host "Failed/skipped : $Failed"
Write-Host "Output         : $Output"
