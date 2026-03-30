# install.ps1 — set up AM on Windows
#
# One-command install (clones + sets up everything):
#   irm https://raw.githubusercontent.com/augmentedmike/am-agi/main/install.ps1 | iex
#
# Or from a cloned repo:
#   .\install.ps1
#
# Requires: PowerShell 5.1+, Windows 10 1809+ (winget)
# Run once. Re-running is safe — skips already-installed components.

$ErrorActionPreference = "Stop"
$PROD_PORT = 4220
$WS_PORT   = 4201

# ── Locate or clone repo ──────────────────────────────────────────────────────

$REPO = $null

# Running from a cloned repo?
if (Test-Path (Join-Path $PSScriptRoot "board\package.json") -ErrorAction SilentlyContinue) {
  $REPO = $PSScriptRoot
} elseif (Test-Path "board\package.json") {
  $REPO = (Get-Location).Path
} else {
  $DEST = if ($env:AM_INSTALL_DIR) { $env:AM_INSTALL_DIR } else { Join-Path $HOME "am" }
  if (Test-Path (Join-Path $DEST ".git")) {
    Write-Host "Updating existing repo at $DEST..."
    git -C $DEST pull --ff-only origin main 2>$null
  } else {
    Write-Host "Cloning AM into $DEST..."
    git clone https://github.com/augmentedmike/am-agi.git $DEST
  }
  $REPO = $DEST
  Set-Location $REPO
}

Write-Host "AM install"
Write-Host "Repo: $REPO"
Write-Host ""

# ── 1. winget ─────────────────────────────────────────────────────────────────

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Write-Error "winget not found. Install App Installer from the Microsoft Store then re-run."
}

# ── 2. Git ────────────────────────────────────────────────────────────────────

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "Installing Git..."
  winget install --id Git.Git --silent --accept-package-agreements --accept-source-agreements
  $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + $env:PATH
}
Write-Host "git: $(git --version)"

# ── 3. Node.js 24 ─────────────────────────────────────────────────────────────

if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (node --version).StartsWith("v24")) {
  Write-Host "Installing Node.js 24..."
  winget install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
  $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + $env:PATH
}
$NPM = (Get-Command npm).Source
Write-Host "node: $(node --version)  npm: $(npm --version)"

# ── 4. Bun ────────────────────────────────────────────────────────────────────

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Write-Host "Installing Bun..."
  powershell -c "irm bun.sh/install.ps1 | iex"
  $env:PATH = "$env:USERPROFILE\.bun\bin;$env:PATH"
}
$BUN = (Get-Command bun).Source
Write-Host "bun: $(bun --version)"

# ── 5. Claude CLI ─────────────────────────────────────────────────────────────

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Write-Host "Installing Claude CLI..."
  npm install -g @anthropic-ai/claude-code
}
$CLAUDE = (Get-Command claude).Source
Write-Host "claude: $CLAUDE"

# ── 6. Board dependencies ─────────────────────────────────────────────────────

Write-Host ""
Write-Host "Installing board dependencies..."
Push-Location "$REPO\board"
npm install
Pop-Location
Write-Host "  done"

# ── 7. Init bin/ ──────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "Initialising bin/..."
# Make bin/ scripts executable (no-op on Windows but keeps parity)
Get-ChildItem "$REPO\bin" | ForEach-Object { $_.IsReadOnly = $false }
Write-Host "  done"

# ── 8. Register Task Scheduler services ───────────────────────────────────────

Write-Host ""
Write-Host "Registering services..."

$BOARD_LOG      = "$env:TEMP\am-board.log"
$WS_SERVER_LOG  = "$env:TEMP\am-ws-server.log"
$DISPATCHER_LOG = "$env:TEMP\am-dispatcher.log"

$KillPort = "powershell -NoProfile -Command `"& { `$p = (netstat -ano | Select-String ':$PROD_PORT ').ToString().Trim().Split()[-1]; if (`$p) { Stop-Process -Id `$p -Force -ErrorAction SilentlyContinue } }`""

$trigger  = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Seconds 5) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew

$tasks = @(
  @{
    Name   = "AM-Board"
    Action = New-ScheduledTaskAction `
      -Execute "cmd.exe" `
      -Argument "/c ($KillPort) & set PORT=$PROD_PORT & set WS_URL=http://localhost:$WS_PORT & set NEXT_PUBLIC_WS_URL=ws://localhost:$WS_PORT & cd /d `"$REPO\board`" & `"$NPM`" run start >> `"$BOARD_LOG`" 2>&1" `
      -WorkingDirectory "$REPO\board"
  },
  @{
    Name   = "AM-WS-Server"
    Action = New-ScheduledTaskAction `
      -Execute "cmd.exe" `
      -Argument "/c set WS_PORT=$WS_PORT & `"$BUN`" run `"$REPO\bin\ws-server`" >> `"$WS_SERVER_LOG`" 2>&1" `
      -WorkingDirectory "$REPO"
  },
  @{
    Name   = "AM-Dispatcher"
    Action = New-ScheduledTaskAction `
      -Execute "cmd.exe" `
      -Argument "/c set BOARD_URL=http://localhost:$PROD_PORT & `"$BUN`" run `"$REPO\bin\dispatcher`" >> `"$DISPATCHER_LOG`" 2>&1" `
      -WorkingDirectory "$REPO"
  }
)

foreach ($task in $tasks) {
  Unregister-ScheduledTask -TaskName $task.Name -Confirm:$false -ErrorAction SilentlyContinue
  Register-ScheduledTask -TaskName $task.Name -Action $task.Action -Trigger $trigger -Settings $settings -RunLevel Limited -Force | Out-Null
  Start-ScheduledTask -TaskName $task.Name
  Write-Host "  started $($task.Name)"
}

# ── 9. Build board ────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "Building board (this takes a minute)..."
Push-Location "$REPO\board"
$env:NEXT_DIST_DIR = ".next"
npm run build
Pop-Location
Write-Host "  done"

# ── 10. Init DB ───────────────────────────────────────────────────────────────

$DB = "$REPO\board\board.db"
if (-not (Test-Path $DB)) {
  Write-Host ""
  Write-Host "Initialising database..."
  Push-Location "$REPO\board"
  $env:DB_PATH = $DB
  npm run db:init
  Pop-Location
  Write-Host "  done"
}

# ── Done ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "Done."
Write-Host ""
Write-Host "  Board: http://localhost:$PROD_PORT"
Write-Host "  Logs:  $BOARD_LOG"
Write-Host ""
Write-Host "Sign in with your Anthropic account in the onboarding flow."
Write-Host ""

# ── Open browser ──────────────────────────────────────────────────────────────

Write-Host "Waiting for AM Board..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$PROD_PORT" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($r.StatusCode -eq 200) { $ready = $true; break }
  } catch {}
  Start-Sleep -Seconds 2
}
if ($ready) {
  Write-Host "  ready — opening http://localhost:$PROD_PORT"
  Start-Process "http://localhost:$PROD_PORT"
}
