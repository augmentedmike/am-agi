# install.ps1 — install dependencies and register scheduled tasks (Windows)
#
# Run once after cloning (PowerShell as current user — no admin required):
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
#   .\launchagents\windows\install.ps1
#
# Tasks auto-start at login and restart on crash.
# Logs: %TEMP%\am-board.log, %TEMP%\am-ws-server.log, %TEMP%\am-dispatcher.log

$ErrorActionPreference = "Stop"
$REPO = Resolve-Path "$PSScriptRoot\..\.."

Write-Host "Repo: $REPO"

# ── 1. winget check ──────────────────────────────────────────────────────────

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Error "winget not found. Install App Installer from the Microsoft Store then re-run."
}

# ── 2. Git ───────────────────────────────────────────────────────────────────

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Git..."
    winget install --id Git.Git --silent --accept-package-agreements --accept-source-agreements
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + $env:PATH
}
Write-Host "git: $(git --version)"

# ── 3. Node.js ───────────────────────────────────────────────────────────────

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Node.js 24..."
    winget install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + $env:PATH
}
$NPM = (Get-Command npm).Source
Write-Host "node: $(node --version)  npm: $(npm --version)"

# ── 4. Bun ───────────────────────────────────────────────────────────────────

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Bun..."
    powershell -c "irm bun.sh/install.ps1 | iex"
    $env:PATH = "$env:USERPROFILE\.bun\bin;$env:PATH"
}
$BUN = (Get-Command bun).Source
Write-Host "bun: $(bun --version)"

# ── 5. Claude CLI ────────────────────────────────────────────────────────────

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Claude CLI..."
    npm install -g @anthropic-ai/claude-code
}
$CLAUDE = (Get-Command claude).Source
Write-Host "claude: $CLAUDE"

# ── 6. Board app dependencies ────────────────────────────────────────────────

Write-Host "Installing board dependencies..."
Push-Location "$REPO\apps\board"
npm install
Pop-Location

# ── 7. Task Scheduler ────────────────────────────────────────────────────────

$BOARD_LOG      = "$env:TEMP\am-board.log"
$WS_SERVER_LOG  = "$env:TEMP\am-ws-server.log"
$DISPATCHER_LOG = "$env:TEMP\am-dispatcher.log"

# Helper: kill whatever is on port 4220 before starting the board
$KillPort = "powershell -NoProfile -Command `"& { `$p = (netstat -ano | Select-String ':4220 ').ToString().Trim().Split()[-1]; if (`$p) { Stop-Process -Id `$p -Force -ErrorAction SilentlyContinue } }`""

# Board task
$boardAction = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c ($KillPort) & cd /d `"$REPO\apps\board`" & `"$NPM`" run dev >> `"$BOARD_LOG`" 2>&1" `
    -WorkingDirectory "$REPO\apps\board"

# WS-Server task (env vars set via wrapper)
$wsServerAction = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c set WS_PORT=4201 & `"$BUN`" run `"$REPO\bin\ws-server`" >> `"$WS_SERVER_LOG`" 2>&1" `
    -WorkingDirectory "$REPO"

# Dispatcher task
$dispatcherAction = New-ScheduledTaskAction `
    -Execute "$BUN" `
    -Argument "run `"$REPO\scripts\dispatcher.ts`"" `
    -WorkingDirectory "$REPO"
$dispatcherEnv = @(
    New-ScheduledTaskSettingsSet   # placeholder — env vars set via wrapper below
)

$trigger  = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Seconds 5) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew

foreach ($task in @(
    @{ Name = "AM-Board";      Action = $boardAction;      Log = $BOARD_LOG },
    @{ Name = "AM-WS-Server";  Action = $wsServerAction;   Log = $WS_SERVER_LOG },
    @{ Name = "AM-Dispatcher"; Action = $dispatcherAction; Log = $DISPATCHER_LOG }
)) {
    # Unregister old version if present
    Unregister-ScheduledTask -TaskName $task.Name -Confirm:$false -ErrorAction SilentlyContinue

    # Board needs WS env vars; Dispatcher needs BOARD_URL env — wrap in cmd with env set
    if ($task.Name -eq "AM-Board") {
        $wrapperAction = New-ScheduledTaskAction `
            -Execute "cmd.exe" `
            -Argument "/c ($KillPort) & set WS_URL=http://localhost:4201 & set NEXT_PUBLIC_WS_URL=ws://localhost:4201 & cd /d `"$REPO\apps\board`" & `"$NPM`" run dev >> `"$BOARD_LOG`" 2>&1" `
            -WorkingDirectory "$REPO\apps\board"
        Register-ScheduledTask `
            -TaskName $task.Name `
            -Action $wrapperAction `
            -Trigger $trigger `
            -Settings $settings `
            -RunLevel Limited `
            -Force | Out-Null
    } elseif ($task.Name -eq "AM-Dispatcher") {
        $wrapperAction = New-ScheduledTaskAction `
            -Execute "cmd.exe" `
            -Argument "/c set BOARD_URL=http://localhost:4220 & `"$BUN`" run `"$REPO\scripts\dispatcher.ts`" >> `"$DISPATCHER_LOG`" 2>&1" `
            -WorkingDirectory "$REPO"
        Register-ScheduledTask `
            -TaskName $task.Name `
            -Action $wrapperAction `
            -Trigger $trigger `
            -Settings $settings `
            -RunLevel Limited `
            -Force | Out-Null
    } else {
        Register-ScheduledTask `
            -TaskName $task.Name `
            -Action $task.Action `
            -Trigger $trigger `
            -Settings $settings `
            -RunLevel Limited `
            -Force | Out-Null
    }

    # Start immediately
    Start-ScheduledTask -TaskName $task.Name
    Write-Host "Registered and started: $($task.Name)"
}

Write-Host ""
Write-Host "Done. Services are running."
Write-Host "  Board:         http://localhost:4220"
Write-Host "  WS Server:     ws://localhost:4201"
Write-Host "  Board log:     $BOARD_LOG"
Write-Host "  WS Server log: $WS_SERVER_LOG"
Write-Host "  Disp log:      $DISPATCHER_LOG"
Write-Host "  Stop:          Stop-ScheduledTask -TaskName AM-Board; Stop-ScheduledTask -TaskName AM-WS-Server; Stop-ScheduledTask -TaskName AM-Dispatcher"
Write-Host "  Remove:        Unregister-ScheduledTask -TaskName AM-Board -Confirm:`$false"
