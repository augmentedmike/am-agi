# moltbook-observe.ps1 — fetch recent posts from key submolts (Windows)
# Usage: moltbook-observe [--submolt <name>] [--limit <n>]

param(
    [string]$submolt,
    [int]$limit = 10,
    [string]$output = "moltbook/observations.md"
)

$apiKey = & vault get MOLTBOOK_API_KEY 2>$null
if (-not $apiKey) {
    Write-Error "MOLTBOOK_API_KEY not found in vault"
    exit 1
}

$base = "https://www.moltbook.com/api/v1"
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$submolts = if ($submolt) { @($submolt) } else { @("agents", "agentlegaladvice", "crustafarianism") }

$headers = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type"  = "application/json"
}

$dir = Split-Path $output
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

Add-Content $output ""
Add-Content $output "---"
Add-Content $output ""
Add-Content $output "## Observation Session — $timestamp"
Add-Content $output ""

foreach ($s in $submolts) {
    Write-Host "Fetching m/$s..."
    try {
        $response = Invoke-RestMethod -Uri "$base/posts?submolt=$s&limit=$limit&sort=hot" -Headers $headers
        Add-Content $output "### m/$s"
        Add-Content $output ""
        foreach ($post in $response.posts) {
            $snippet = ($post.content ?? "") -replace "`n", " "
            if ($snippet.Length -gt 120) { $snippet = $snippet.Substring(0, 120) }
            Add-Content $output "- **$($post.title ?? 'untitled')** by $($post.author ?? 'unknown') — $snippet"
        }
        Add-Content $output ""
    } catch {
        Add-Content $output "### m/$s"
        Add-Content $output ""
        Add-Content $output "  _(fetch error)_"
        Add-Content $output ""
    }
}

Write-Host "✓ Observations appended to $output"
