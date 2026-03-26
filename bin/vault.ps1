# vault.ps1 — age-encrypted secrets store for AM (Windows native / PowerShell)
#
# Each secret is its own .age file — only the requested key is ever decrypted.
#
# Prerequisites:
#   age    — winget install FiloSottile.age
#            OR choco install age.portable
#            OR scoop install age
#            OR https://github.com/FiloSottile/age/releases
#
# Key storage:
#   Private key  $HOME\.ssh\am_vault
#   Public key   $HOME\.ssh\am_vault.pub
#   Secrets      workspaces\vault\<key>.age
#
# Usage:
#   .\vault.ps1 init
#   .\vault.ps1 set <key> [value]
#   .\vault.ps1 get <key>
#   .\vault.ps1 list
#   .\vault.ps1 rm <key>
#   .\vault.ps1 keys
#   .\vault.ps1 check

param(
    [Parameter(Position=0)] [string]$Command = "help",
    [Parameter(Position=1)] [string]$Key = "",
    [Parameter(Position=2)] [string]$Value = ""
)

$ErrorActionPreference = "Stop"

$AmRoot   = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$VaultDir = Join-Path $AmRoot "workspaces\vault"
$KeyDir   = Join-Path $HOME ".ssh"
$PrivKey  = Join-Path $KeyDir "am_vault"
$PubKey   = Join-Path $KeyDir "am_vault.pub"

New-Item -ItemType Directory -Force -Path $VaultDir | Out-Null
New-Item -ItemType Directory -Force -Path $KeyDir   | Out-Null

# ── Find age binary ──────────────────────────────────────────────────────────

function Find-Age {
    foreach ($candidate in @("age", "age.exe")) {
        $found = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($found) { return $found.Source }
    }
    # Check common Scoop / Chocolatey / winget paths
    $paths = @(
        "$HOME\scoop\shims\age.exe",
        "C:\ProgramData\chocolatey\bin\age.exe",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\FiloSottile.age_*\age.exe"
    )
    foreach ($p in $paths) {
        $resolved = Resolve-Path $p -ErrorAction SilentlyContinue
        if ($resolved) { return $resolved.Path }
    }
    return $null
}

function Find-AgeKeygen {
    foreach ($candidate in @("age-keygen", "age-keygen.exe")) {
        $found = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($found) { return $found.Source }
    }
    foreach ($p in @(
        "$HOME\scoop\shims\age-keygen.exe",
        "C:\ProgramData\chocolatey\bin\age-keygen.exe"
    )) {
        $resolved = Resolve-Path $p -ErrorAction SilentlyContinue
        if ($resolved) { return $resolved.Path }
    }
    return $null
}

$AgeBin      = Find-Age
$AgeKeygenBin = Find-AgeKeygen

function Install-Hint {
    Write-Host "Install age on Windows:"
    Write-Host "  winget install FiloSottile.age"
    Write-Host "  OR: choco install age.portable"
    Write-Host "  OR: scoop install age"
    Write-Host "  OR: https://github.com/FiloSottile/age/releases"
}

function Need-Age {
    if (-not $AgeBin) {
        Write-Error "vault: 'age' not found."
        Install-Hint
        exit 1
    }
}

function Need-AgeKeygen {
    if (-not $AgeKeygenBin) {
        Write-Error "vault: 'age-keygen' not found."
        Install-Hint
        exit 1
    }
}

function Need-Init {
    if (-not (Test-Path $PrivKey)) {
        Write-Error "vault: not initialised — run: vault.ps1 init"
        exit 1
    }
}

function Validate-Key([string]$k) {
    if ($k -notmatch '^[a-zA-Z0-9_-]+$') {
        Write-Error "vault: invalid key name '$k' — use letters, digits, _ and - only"
        exit 1
    }
}

function Secret-Path([string]$k) {
    return Join-Path $VaultDir "$k.age"
}

# ── Commands ──────────────────────────────────────────────────────────────────

function Cmd-Init {
    Need-AgeKeygen
    if (Test-Path $PrivKey) {
        $pub = (Get-Content $PrivKey | Select-String 'public key:').Line -replace '.*public key: ', ''
        Write-Host "vault: keypair already exists at $PrivKey"
        Write-Host "       public key: $pub"
        return
    }
    & $AgeKeygenBin -o $PrivKey 2>$null
    # Extract public key
    $pubLine = Get-Content $PrivKey | Select-String 'public key:'
    $pubKey  = $pubLine.Line -replace '.*public key: ', ''
    Set-Content -Path $PubKey -Value $pubKey

    Write-Host "vault: keypair generated"
    Write-Host "  private key: $PrivKey"
    Write-Host "  public key:  $pubKey"
}

function Cmd-Set {
    Need-Age
    Need-Init
    if (-not $Key) { Write-Error "usage: vault.ps1 set <key> [value]"; exit 1 }
    Validate-Key $Key

    $pub  = Get-Content $PubKey
    $file = Secret-Path $Key

    if ($Value) {
        # Value passed directly — pipe to age
        $Value | & $AgeBin -r $pub -o $file
    } else {
        # Interactive — prompt without echo
        $secStr = Read-Host -Prompt "value for '$Key'" -AsSecureString
        $plain  = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
                      [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secStr))
        $plain | & $AgeBin -r $pub -o $file
    }
    Write-Host "vault: set $Key"
}

function Cmd-Get {
    Need-Age
    Need-Init
    if (-not $Key) { Write-Error "usage: vault.ps1 get <key>"; exit 1 }
    Validate-Key $Key

    $file = Secret-Path $Key
    if (-not (Test-Path $file)) { Write-Error "vault: no secret named '$Key'"; exit 1 }

    # Output raw — caller can capture with $(...) or $(.\vault.ps1 get key)
    & $AgeBin --decrypt -i $PrivKey $file
}

function Cmd-List {
    Need-Init
    $files = Get-ChildItem -Path $VaultDir -Filter "*.age" -ErrorAction SilentlyContinue
    if (-not $files) {
        Write-Host "(vault is empty)"
    } else {
        $files | ForEach-Object { $_.BaseName }
    }
}

function Cmd-Rm {
    Need-Init
    if (-not $Key) { Write-Error "usage: vault.ps1 rm <key>"; exit 1 }
    Validate-Key $Key

    $file = Secret-Path $Key
    if (-not (Test-Path $file)) { Write-Error "vault: no secret named '$Key'"; exit 1 }
    Remove-Item $file
    Write-Host "vault: removed $Key"
}

function Cmd-Keys {
    Need-Init
    $pub = Get-Content $PubKey
    Write-Host "public key:  $pub"
    Write-Host "private key: $PrivKey"
    Write-Host "vault dir:   $VaultDir"
}

function Cmd-Check {
    $ok = $true

    Write-Host -NoNewline "platform:     "; Write-Host "Windows (PowerShell)"

    Write-Host -NoNewline "age binary:   "
    if ($AgeBin) {
        $ver = & $AgeBin --version 2>&1
        Write-Host "ok ($ver at $AgeBin)"
    } else {
        Write-Host "MISSING"
        Install-Hint
        $ok = $false
    }

    Write-Host -NoNewline "private key:  "
    if (Test-Path $PrivKey) {
        Write-Host "ok ($PrivKey)"
    } else {
        Write-Host "missing — run: vault.ps1 init"
        $ok = $false
    }

    Write-Host -NoNewline "vault dir:    "
    if (Test-Path $VaultDir) {
        Write-Host "ok ($VaultDir)"
    } else {
        Write-Host "missing (will be created on first use)"
    }

    if (Test-Path $PrivKey) {
        $count = (Get-ChildItem -Path $VaultDir -Filter "*.age" -ErrorAction SilentlyContinue | Measure-Object).Count
        Write-Host "secrets:      $count stored"
    }

    if ($ok) { Write-Host "vault: ready" } else { Write-Host "vault: not ready"; exit 1 }
}

# ── Dispatch ──────────────────────────────────────────────────────────────────

switch ($Command.ToLower()) {
    "init"  { Cmd-Init }
    "set"   { Cmd-Set  }
    "get"   { Cmd-Get  }
    "list"  { Cmd-List }
    "rm"    { Cmd-Rm   }
    "keys"  { Cmd-Keys }
    "check" { Cmd-Check }
    default {
        Write-Host @"
vault.ps1 — age-encrypted secrets for AM (Windows / PowerShell)

  vault.ps1 init                  generate keypair (once per machine)
  vault.ps1 set <key> [value]     store a secret (prompts if no value)
  vault.ps1 get <key>             decrypt and print one secret
  vault.ps1 list                  list key names only
  vault.ps1 rm <key>              delete a secret
  vault.ps1 keys                  show key locations
  vault.ps1 check                 verify vault is ready

Inline usage:
  `$env:ANTHROPIC_API_KEY = .\vault.ps1 get anthropic_api_key
  `$headers = @{ Authorization = "Bearer $(.\vault.ps1 get my_token)" }

Install age (required):
  winget install FiloSottile.age
  OR: choco install age.portable
  OR: scoop install age

Secrets live in workspaces\vault\<key>.age  (gitignored)
Private key lives in ~\.ssh\am_vault        (never in repo)

For bash/WSL/Git Bash: use bin/vault instead.
"@
    }
}
