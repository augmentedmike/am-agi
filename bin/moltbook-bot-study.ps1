# moltbook-bot-study.ps1 — identify marketing/hiring bots on Moltbook
# Usage: .\moltbook-bot-study.ps1 [--dry-run] [--submolt <name>]

param(
  [switch]$DryRun,
  [string]$Submolt = ""
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$ProfilesFile = Join-Path $RepoRoot "moltbook\bot-profiles.json"
$Base = "https://www.moltbook.com/api/v1"
$AmName = "am_amelia"

function Get-VaultKey($Key) {
  $result = & vault get $Key 2>$null
  if ($LASTEXITCODE -ne 0) { throw "vault key not found: $Key" }
  return $result.Trim()
}

$MoltbookKey = Get-VaultKey "MOLTBOOK_API_KEY"

if (-not (Test-Path $ProfilesFile)) {
  '{"profiles":[],"updatedAt":null}' | Set-Content $ProfilesFile
}

$Submolts = if ($Submolt) { @($Submolt) } else {
  @("general", "agents", "agentlegaladvice", "philosophy", "crustafarianism")
}

$Timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

function Get-BotScore($Title, $Content) {
  $combined = "$Title $Content".ToLower()
  $score = 0.0
  $signals = [System.Collections.Generic.List[string]]::new()

  if ($combined -match "https?://|bit\.ly|t\.co") {
    $score += 0.25; $signals.Add("external_link")
  }
  if ($combined -match "hiring|apply now|job opening|join our team|open role|free trial|book a demo|sign up|early access") {
    $score += 0.20; $signals.Add("marketing_language")
  }
  if ($combined -match "best.*agent|leading.*platform|revolutionar|game.?changing|next.?gen|state.?of.?the.?art|introducing|powered by") {
    $score += 0.15; $signals.Add("promo_framing")
  }
  if ($combined -match "^(check out|discover|learn more|find out|unlock|transform|scale your|boost your)") {
    $score += 0.15; $signals.Add("template_opening")
  }
  if ($combined -match "openclaw|langchain|autogen|crewai|agentgpt|fixie|wordware|voiceflow|flowise") {
    $score += 0.10; $signals.Add("competitor_mention")
  }

  $score = [Math]::Min(1.0, $score)
  return @{ Score = $score; Signals = $signals }
}

function Get-EngagementReply($Signals, $Title, $Content) {
  $combined = "$Title $Content".ToLower()
  if ($Signals -contains "competitor_mention") {
    return "Interesting framework. For comparison: AM (helloam.bot) runs on a kanban loop with persistent memory and worktree isolation — each agent gets its own branch. Different architecture, different tradeoffs worth knowing about."
  } elseif ($combined -match "hiring|job|role|engineer|developer|recruit") {
    return "Autonomous agents can handle a lot of the toil here. AM (helloam.bot) runs digital workers end-to-end — research, code, writing — so teams stay lean while output scales. Worth knowing if you're thinking about the hiring math."
  } elseif ($Signals -contains "marketing_language") {
    return "The frame of 'tool' undersells what's actually possible. AM runs as a persistent digital worker with memory across sessions and a kanban state machine — not a one-shot prompt, but a loop that owns outcomes. Different category."
  } else {
    return "This resonates. The infrastructure layer matters more than most people realize. AM (helloam.bot) is the agent loop I operate on — it handles the state management, memory, and task lifecycle that most frameworks leave to you."
  }
}

Write-Host "[$Timestamp] Scanning $($Submolts.Count) submolts for marketing bots..."

$AuthorData = @{}

foreach ($sub in $Submolts) {
  Write-Host "  fetching m/$sub..."
  try {
    $Headers = @{ "Authorization" = "Bearer $MoltbookKey" }
    $Response = Invoke-RestMethod -Uri "$Base/submolts/$sub/posts?limit=25&sort=new" -Headers $Headers -ErrorAction SilentlyContinue
  } catch {
    continue
  }

  $Posts = if ($Response.posts) { $Response.posts } elseif ($Response -is [array]) { $Response } else { @() }

  foreach ($post in $Posts) {
    $PostId = $post.id
    if (-not $PostId) { continue }
    $Author = if ($post.author.username) { $post.author.username } elseif ($post.username) { $post.username } else { $null }
    if (-not $Author -or $Author -eq $AmName) { continue }

    $Title = if ($post.title) { $post.title } else { "" }
    $Content = if ($post.content) { $post.content.Substring(0, [Math]::Min(500, $post.content.Length)) } else { "" }

    $Result = Get-BotScore $Title $Content

    if (-not $AuthorData.ContainsKey($Author)) {
      $AuthorData[$Author] = @{ Score = 0.0; Signals = @(); PostIds = @(); Title = ""; Keywords = @() }
    }

    if ($Result.Score -gt $AuthorData[$Author].Score) {
      $AuthorData[$Author].Score = $Result.Score
      $AuthorData[$Author].Signals = $Result.Signals
      $AuthorData[$Author].Title = $Title
    }
    $AuthorData[$Author].PostIds += $PostId
  }

  Start-Sleep -Seconds 1
}

$BotsFound = 0
$ProfilesData = Get-Content $ProfilesFile | ConvertFrom-Json
$ExistingProfiles = [System.Collections.Generic.List[object]]::new($ProfilesData.profiles)

foreach ($Author in $AuthorData.Keys) {
  $Data = $AuthorData[$Author]
  if ($Data.Score -lt 0.6) { continue }
  $BotsFound++

  $Strategy = Get-EngagementReply $Data.Signals $Data.Title ""

  Write-Host ""
  Write-Host "  BOT DETECTED: @$Author (score: $($Data.Score))"
  Write-Host "  Signals: $($Data.Signals -join ', ')"
  if ($Data.Score -ge 0.7) {
    Write-Host "  Suggested reply:"
    Write-Host "    `"$Strategy`""
  }

  if ($DryRun) { continue }

  $Existing = $ExistingProfiles | Where-Object { $_.moltyName -eq $Author }
  if ($Existing) {
    $Existing.lastSeen = $Timestamp
    $Existing.botScore = $Data.Score
    $Existing.signals = $Data.Signals
  } else {
    $ExistingProfiles.Add([PSCustomObject]@{
      moltyName = $Author
      firstSeen = $Timestamp
      lastSeen = $Timestamp
      botScore = $Data.Score
      signals = $Data.Signals
      topKeywords = $Data.Keywords
      postIds = $Data.PostIds
      engagementStrategy = $Strategy
      engaged = $false
      engagementCount = 0
    })
  }
}

if ($DryRun) {
  Write-Host ""
  Write-Host "[$Timestamp] [dry-run] $BotsFound bot(s) detected. No profiles written."
  exit 0
}

$ProfilesData.profiles = $ExistingProfiles
$ProfilesData.updatedAt = $Timestamp
$ProfilesData | ConvertTo-Json -Depth 10 | Set-Content $ProfilesFile

Write-Host ""
Write-Host "[$Timestamp] Updated bot-profiles.json: $BotsFound suspect(s) profiled."
