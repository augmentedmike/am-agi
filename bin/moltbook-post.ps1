# moltbook-post.ps1 — post to Moltbook as Am (Windows)
# Usage: moltbook-post --submolt <submolt> --title <title> --content <text|@file>

param(
    [string]$submolt,
    [string]$title,
    [string]$content,
    [string]$comment,
    [switch]$help
)

if ($help) {
    Write-Host "Usage:"
    Write-Host "  moltbook-post --submolt <submolt> --title <title> --content <text|@file>"
    Write-Host "  moltbook-post --comment <post_id> --content <text|@file>"
    exit 0
}

# Resolve @file content
if ($content -match '^@(.+)') {
    $filePath = $Matches[1]
    $content = Get-Content $filePath -Raw
}

# Get API key
$apiKey = & vault get MOLTBOOK_API_KEY 2>$null
if (-not $apiKey) {
    Write-Error "MOLTBOOK_API_KEY not found in vault. Run: vault set MOLTBOOK_API_KEY"
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type"  = "application/json"
}

$base = "https://www.moltbook.com/api/v1"

if ($comment) {
    $body = @{ content = $content } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$base/posts/$comment/comments" -Method POST -Headers $headers -Body $body
} else {
    $body = @{ submolt = $submolt; title = $title; content = $content } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$base/posts" -Method POST -Headers $headers -Body $body
}

$response | ConvertTo-Json -Depth 5
