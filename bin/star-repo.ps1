#!/usr/bin/env pwsh
param(
    [string]$Arg1 = "",
    [string]$Arg2 = ""
)

function Show-Usage {
    Write-Host "Usage: star-repo {owner}/{repo}"
    Write-Host "       star-repo {owner} {repo}"
    exit 1
}

# Parse arguments
if ($Arg1 -eq "") {
    Show-Usage
} elseif ($Arg2 -ne "") {
    # Two-argument format: owner repo
    $Owner = $Arg1
    $Repo = $Arg2
} elseif ($Arg1 -match "^([^/]+)/([^/]+)$") {
    # Slash-separated format: owner/repo
    $Owner = $Matches[1]
    $Repo = $Matches[2]
} else {
    Write-Error "Error: single argument must be in 'owner/repo' format"
    Show-Usage
}

if ([string]::IsNullOrEmpty($Owner) -or [string]::IsNullOrEmpty($Repo)) {
    Write-Error "Error: owner and repo must not be empty"
    Show-Usage
}

gh api -X PUT "/user/starred/$Owner/$Repo" --silent
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to star ${Owner}/${Repo}"
    exit 1
}
Write-Host "Starred ${Owner}/${Repo}"
