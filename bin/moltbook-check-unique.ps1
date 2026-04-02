# moltbook-check-unique.ps1 — check if a post idea is unique before submitting
# Searches own previous posts AND recent submolt posts for similar content.
#
# Usage:
#   .\moltbook-check-unique.ps1 --title <title> --submolt <submolt> [--content-file <path>]
#
# Exit codes:
#   0 — no similar posts found (safe to post)
#   1 — similar post(s) found (abort or use --force in moltbook-post)

param(
  [string]$title = "",
  [string]$submolt = "",
  [string]$contentFile = ""
)

$MATCH_THRESHOLD = 2

$STOPWORDS = @("about","after","also","back","been","before","being","could","does","down",
  "each","even","from","have","here","into","just","like","more","most","much","must",
  "need","only","over","same","should","some","such","than","that","their","them","then",
  "there","these","they","this","through","time","under","very","want","well","were",
  "what","when","where","which","while","will","with","would","your")

if (-not $title -or -not $submolt) {
  Write-Host "Usage: moltbook-check-unique.ps1 --title <title> --submolt <submolt>"
  exit 1
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$amRoot = Split-Path -Parent $scriptDir
$moltbookDir = Join-Path $amRoot "moltbook"

function Extract-Words($text) {
  $lower = $text.ToLower() -replace '[^\w\s]', ' ' -replace '\s+', ' '
  $words = $lower.Split(' ') | Where-Object {
    $_.Length -gt 4 -and $_ -notin $STOPWORDS
  }
  return $words
}

function Count-Matches($text, $words) {
  $textLower = $text.ToLower()
  $count = 0
  foreach ($word in $words) {
    if ($textLower -match "\b$([regex]::Escape($word))\b") {
      $count++
    }
  }
  return $count
}

$sigWords = Extract-Words $title
if ($sigWords.Count -eq 0) {
  Write-Host "Warning: no significant words extracted — skipping check"
  exit 0
}

Write-Host "Checking uniqueness for: `"$title`""
Write-Host "Significant words: $($sigWords -join ', ')"
Write-Host ""

$foundMatches = $false
$ownMatches = @()

# Check post-log.md
$postLog = Join-Path $moltbookDir "post-log.md"
if (Test-Path $postLog) {
  foreach ($line in Get-Content $postLog) {
    if ($line.StartsWith("|")) {
      $cols = $line -split '\|'
      if ($cols.Count -ge 4) {
        $postTitle = $cols[2].Trim()
        if ($postTitle -and $postTitle -ne "Title") {
          $matches = Count-Matches $postTitle $sigWords
          if ($matches -ge $MATCH_THRESHOLD) {
            $ownMatches += "post-log: `"$postTitle`" ($matches matching words)"
          }
        }
      }
    }
  }
}

# Check posts/*.md
$postsDir = Join-Path $moltbookDir "posts"
if (Test-Path $postsDir) {
  foreach ($postFile in Get-ChildItem $postsDir -Filter "*.md") {
    $content = Get-Content $postFile.FullName -Raw
    $matches = Count-Matches $content $sigWords
    if ($matches -ge $MATCH_THRESHOLD) {
      $ownMatches += "posts/$($postFile.Name) ($matches matching words)"
    }
  }
}

Write-Host "▸ Checking own posts..."
if ($ownMatches.Count -gt 0) {
  Write-Host "  ✗ Similar own posts found:"
  foreach ($m in $ownMatches) { Write-Host "    - $m" }
  $foundMatches = $true
} else {
  Write-Host "  ✓ No similar own posts found"
}

Write-Host ""

# Check submolt via API
Write-Host "▸ Checking m/$submolt recent posts..."

try {
  $apiKey = & vault get MOLTBOOK_API_KEY 2>$null
} catch {
  Write-Host "  ⚠ MOLTBOOK_API_KEY not found — skipping submolt check"
  if ($foundMatches) { exit 1 }
  exit 0
}

$base = "https://www.moltbook.com/api/v1"
$headers = @{ Authorization = "Bearer $apiKey"; "Content-Type" = "application/json" }
$submoltMatches = @()

try {
  $resp = Invoke-RestMethod "$base/submolts/$submolt/posts?limit=20&sort=new" -Headers $headers
  $posts = $resp.posts
  foreach ($post in $posts) {
    if ($post.title) {
      $matches = Count-Matches $post.title $sigWords
      if ($matches -ge $MATCH_THRESHOLD) {
        $submoltMatches += "m/$submolt: `"$($post.title)`" ($matches matching words)"
      }
    }
  }
} catch {
  Write-Host "  ⚠ Could not fetch submolt posts: $_"
}

if ($submoltMatches.Count -gt 0) {
  Write-Host "  ✗ Similar submolt posts found:"
  foreach ($m in $submoltMatches) { Write-Host "    - $m" }
  $foundMatches = $true
} else {
  Write-Host "  ✓ No similar submolt posts found"
}

Write-Host ""

if ($foundMatches) {
  Write-Host "✗ Uniqueness check FAILED — similar content exists."
  Write-Host "  Rethink the angle, or use --force to override."
  exit 1
} else {
  Write-Host "✓ Uniqueness check PASSED — post away."
  exit 0
}
