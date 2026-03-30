# uninstall.ps1 — remove AM scheduled tasks (Windows)
#
# Does NOT delete databases, workspaces, or any user data.
# Run this to stop AM from auto-starting at login.
#
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
#   .\uninstall.ps1

$ErrorActionPreference = "Stop"

Write-Host "AM uninstall"
Write-Host ""

foreach ($name in @("AM-Board", "AM-WS-Server", "AM-Dispatcher")) {
    $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
    if ($task) {
        Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $name -Confirm:$false
        Write-Host "  removed $name"
    } else {
        Write-Host "  $name not found (skipping)"
    }
}

Write-Host ""
Write-Host "Done. Services removed."
Write-Host "Databases and workspaces are untouched."
