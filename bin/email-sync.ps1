# email-sync.ps1 — manage email sync accounts and trigger syncs via the board API
#
# Usage:
#   email-sync list-accounts
#   email-sync add-account --provider <provider> --account <account-email>
#   email-sync remove-account <id>
#   email-sync sync [--account <id>]

param(
    [Parameter(Position=0)]
    [string]$Command = "help",
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Args
)

$BOARD_URL = if ($env:BOARD_URL) { $env:BOARD_URL } else { "http://localhost:4220" }

function Die([string]$msg) {
    Write-Error "error: $msg"
    exit 1
}

function Api-Get([string]$path) {
    try {
        Invoke-RestMethod -Uri "$BOARD_URL$path" -Method GET -ContentType "application/json"
    } catch {
        Die "could not reach board API at $BOARD_URL"
    }
}

function Api-Post([string]$path, [string]$body) {
    try {
        Invoke-RestMethod -Uri "$BOARD_URL$path" -Method POST -ContentType "application/json" -Body $body
    } catch {
        Die "could not reach board API at $BOARD_URL"
    }
}

function Api-Delete([string]$path) {
    try {
        $response = Invoke-WebRequest -Uri "$BOARD_URL$path" -Method DELETE -ContentType "application/json"
        return $response.StatusCode
    } catch {
        Die "could not reach board API at $BOARD_URL"
    }
}

function Cmd-ListAccounts {
    Api-Get "/api/email-syncs" | ConvertTo-Json -Depth 10
}

function Cmd-AddAccount([string[]]$argv) {
    $provider = ""
    $accountEmail = ""
    $i = 0
    while ($i -lt $argv.Length) {
        switch ($argv[$i]) {
            "--provider" { $provider = $argv[$i+1]; $i += 2 }
            "--account"  { $accountEmail = $argv[$i+1]; $i += 2 }
            default      { Die "unknown flag: $($argv[$i])" }
        }
    }
    if (-not $provider)      { Die "--provider is required" }
    if (-not $accountEmail)  { Die "--account is required" }

    $body = "{`"provider`":`"$provider`",`"accountEmail`":`"$accountEmail`"}"
    Api-Post "/api/email-syncs" $body | ConvertTo-Json -Depth 10
}

function Cmd-RemoveAccount([string[]]$argv) {
    $id = if ($argv.Length -gt 0) { $argv[0] } else { "" }
    if (-not $id) { Die "usage: email-sync remove-account <id>" }
    $status = Api-Delete "/api/email-syncs/$id"
    if ($status -eq 204) {
        Write-Output "removed $id"
    } else {
        Die "unexpected status $status removing sync account $id"
    }
}

function Cmd-Sync([string[]]$argv) {
    $id = ""
    $i = 0
    while ($i -lt $argv.Length) {
        switch ($argv[$i]) {
            "--account" { $id = $argv[$i+1]; $i += 2 }
            default     { $id = $argv[$i]; $i += 1 }
        }
    }
    $path = if ($id) { "/api/email-syncs/$id/sync" } else { "/api/email-syncs/sync" }
    Api-Post $path "{}" | ConvertTo-Json -Depth 10
}

function Show-Help {
    Write-Output @"
email-sync — manage email sync accounts and trigger syncs

  email-sync list-accounts
      List all registered sync accounts.

  email-sync add-account --provider <provider> --account <account-email>
      Register a new email sync account.
      --provider   Email provider name (e.g. gmail, outlook)
      --account    Account email address

  email-sync remove-account <id>
      Remove a registered sync account by ID.

  email-sync sync [--account <id>]
      Trigger a sync. If --account is omitted, syncs all accounts.

Environment:
  BOARD_URL   Board API base URL (default: http://localhost:4220)
"@
}

switch ($Command) {
    "list-accounts"   { Cmd-ListAccounts }
    "add-account"     { Cmd-AddAccount $Args }
    "remove-account"  { Cmd-RemoveAccount $Args }
    "sync"            { Cmd-Sync $Args }
    { $_ -in "help", "--help", "-h" } { Show-Help }
    default { Write-Error "unknown command: $Command — run 'email-sync help'"; exit 1 }
}
