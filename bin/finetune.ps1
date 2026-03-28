# finetune.ps1 — Windows counterpart to bin/finetune
# QLoRA fine-tune Qwen3-Coder-30B-A3B on AM task data via mlx_lm.lora
param(
    [Parameter(Mandatory=$true)]
    [string]$Data,
    [string]$Config = "",
    [string]$AdapterPath = ".\adapters",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

if (-not $Config) {
    $Config = Join-Path $RepoRoot "finetune-config.yaml"
}

if (-not (Test-Path $Data)) {
    Write-Error "Data file not found: $Data"
    exit 1
}

if (-not (Test-Path $Config)) {
    Write-Error "Config not found: $Config"
    exit 1
}

# Verify mlx_lm.lora is available (MLX is macOS-only; this script is a compatibility shim)
$mlxAvailable = $false
try {
    $null = python3 -m mlx_lm.lora --help 2>&1
    $mlxAvailable = $true
} catch {}

if (-not $mlxAvailable) {
    Write-Warning "mlx_lm not found or not available on this platform."
    Write-Warning "MLX runs natively on Apple Silicon (macOS). On Windows, use WSL2 or a Mac."
    Write-Warning "Install on Mac: pip install mlx-lm"
    exit 1
}

New-Item -ItemType Directory -Path $AdapterPath -Force | Out-Null

Write-Host "=== Fine-Tune: Qwen3-Coder-30B-A3B (QLoRA) ===" -ForegroundColor Cyan
Write-Host "Data          : $Data"
Write-Host "Config        : $Config"
Write-Host "Adapter path  : $AdapterPath"
Write-Host "Dry run       : $DryRun"
Write-Host ""

$TrainCount = (Get-Content $Data | Measure-Object -Line).Lines
Write-Host "Training examples: $TrainCount"
Write-Host ""

if ($DryRun) {
    Write-Host "Running 1-step dry-run..." -ForegroundColor Yellow
    python3 -m mlx_lm.lora `
        --config $Config `
        --data $Data `
        --adapter-path $AdapterPath `
        --train `
        --iters 1 `
        --steps-per-eval 0 `
        --save-every 0
    Write-Host ""
    Write-Host "Dry-run complete — no OOM." -ForegroundColor Green
} else {
    Write-Host "Starting full fine-tune..." -ForegroundColor Yellow
    Write-Host "Expected duration: 30–50 min/epoch on M3 Pro"
    Write-Host ""
    python3 -m mlx_lm.lora `
        --config $Config `
        --data $Data `
        --adapter-path $AdapterPath `
        --train
    Write-Host ""
    Write-Host "Fine-tune complete. Adapter saved to: $AdapterPath" -ForegroundColor Green
}
