# email-sync.ps1 — manage email provider accounts and trigger syncs for AM CRM (Windows)
#
# Usage:
#   email-sync list-accounts
#   email-sync add-account --provider <gmail|outlook|imap> --account <email>
#   email-sync remove-account <id>
#   email-sync sync [--account <id>]

param(
  [Parameter(Position=0)]
  [string]$Command = "help",
  [Parameter(ValueFromRemainingArguments=$true)]
  [string[]]$Args = @()
)

$ErrorActionPreference = "Stop"

$AM_ROOT = Split-Path $PSScriptRoot -Parent
$BOARD_DB = if ($env:DB_PATH) { $env:DB_PATH } else { Join-Path $AM_ROOT "board.db" }

function New-Id {
  [guid]::NewGuid().ToString().ToLower()
}

function Get-NowIso {
  (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

function Require-Db {
  if (-not (Test-Path $BOARD_DB)) {
    Write-Error "board.db not found at $BOARD_DB`nSet DB_PATH or run from the AM root directory."
    exit 1
  }
}

function Invoke-Sqlite {
  param([string]$Sql)
  & sqlite3 $BOARD_DB $Sql
}

function cmd_list_accounts {
  Require-Db
  $rows = Invoke-Sqlite "SELECT id, provider, account_email, sync_status, COALESCE(last_sync_at,'never') FROM email_syncs ORDER BY created_at ASC;"
  if (-not $rows) {
    Write-Host "(no accounts configured)"
    return
  }
  Write-Host ("{0,-36}  {1,-10}  {2,-30}  {3,-10}  {4}" -f "ID","PROVIDER","ACCOUNT","STATUS","LAST SYNC")
  Write-Host ("{0,-36}  {1,-10}  {2,-30}  {3,-10}  {4}" -f "----","--------","-------","------","---------")
  foreach ($row in $rows) {
    $parts = $row -split "\|"
    Write-Host ("{0,-36}  {1,-10}  {2,-30}  {3,-10}  {4}" -f $parts[0],$parts[1],$parts[2],$parts[3],$parts[4])
  }
}

function cmd_add_account {
  $provider = ""; $account = ""
  for ($i = 0; $i -lt $Args.Count; $i++) {
    switch ($Args[$i]) {
      "--provider" { $provider = $Args[++$i] }
      "--account"  { $account  = $Args[++$i] }
      default { Write-Error "unknown flag: $($Args[$i])"; exit 1 }
    }
  }
  if (-not $provider) { Write-Error "--provider is required (gmail|outlook|imap)"; exit 1 }
  if (-not $account)  { Write-Error "--account is required"; exit 1 }
  if ($provider -notin @("gmail","outlook","imap")) { Write-Error "--provider must be gmail, outlook, or imap"; exit 1 }

  Require-Db
  $id = New-Id
  $now = Get-NowIso
  Invoke-Sqlite "INSERT INTO email_syncs(id,provider,account_email,sync_status,created_at,updated_at) VALUES('$id','$provider','$account','idle','$now','$now');"
  Write-Host $id
  Write-Host "added $provider account: $account"
}

function cmd_remove_account {
  $id = if ($Args.Count -gt 0) { $Args[0] } else { "" }
  if (-not $id) { Write-Error "usage: email-sync remove-account <id>"; exit 1 }
  Require-Db
  $exists = Invoke-Sqlite "SELECT COUNT(*) FROM email_syncs WHERE id='$id';"
  if ($exists -eq "0") { Write-Error "not found: $id"; exit 1 }
  Invoke-Sqlite "DELETE FROM email_syncs WHERE id='$id';"
  Write-Host "removed account $id"
}

function cmd_sync {
  $account_id = ""
  for ($i = 0; $i -lt $Args.Count; $i++) {
    if ($Args[$i] -eq "--account") { $account_id = $Args[++$i] }
  }
  Require-Db
  $now = Get-NowIso
  if ($account_id) {
    $exists = Invoke-Sqlite "SELECT COUNT(*) FROM email_syncs WHERE id='$account_id';"
    if ($exists -eq "0") { Write-Error "not found: $account_id"; exit 1 }
    Invoke-Sqlite "UPDATE email_syncs SET sync_status='syncing', updated_at='$now' WHERE id='$account_id';"
    Write-Host "sync started for account $account_id"
  } else {
    $count = Invoke-Sqlite "SELECT COUNT(*) FROM email_syncs;"
    if ($count -eq "0") { Write-Host "(no accounts configured — add one with: email-sync add-account)"; return }
    Invoke-Sqlite "UPDATE email_syncs SET sync_status='syncing', updated_at='$now';"
    Write-Host "sync started for all accounts ($count)"
  }
}

switch ($Command) {
  "list-accounts"  { cmd_list_accounts }
  "add-account"    { cmd_add_account }
  "remove-account" { cmd_remove_account }
  "sync"           { cmd_sync }
  { $_ -in @("help","--help","-h") } {
    Write-Host @"
email-sync — manage email provider accounts and trigger syncs

  email-sync list-accounts
  email-sync add-account --provider <gmail|outlook|imap> --account <email>
  email-sync remove-account <id>
  email-sync sync [--account <id>]

Storage: board.db (set DB_PATH env var to override)
"@
  }
  default {
    Write-Error "unknown command: $Command — run 'email-sync help'"
    exit 1
  }
}
