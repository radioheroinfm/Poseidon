# Poseidon - verification run for kolyan-patch-01 (Windows 11, PowerShell).
# Usage (from the repo root):  powershell -ExecutionPolicy Bypass -File scripts\kolyan-verify.ps1
# Writes the full log to logs\kolyan-verify-<utc timestamp>.log
$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force -Path logs | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$log = "logs\kolyan-verify-$stamp.log"
Start-Transcript -Path $log -Force | Out-Null

Write-Host "== environment"
Write-Host ("date:   " + (Get-Date).ToUniversalTime().ToString('o'))
Write-Host ("host:   " + [System.Environment]::OSVersion.VersionString)
Write-Host ("git:    " + (git rev-parse --short HEAD 2>&1))
Write-Host ("node:   " + (node --version 2>&1))
Write-Host ("npm:    " + (npm --version 2>&1))
Write-Host ("rustc:  " + (rustc --version 2>&1))
Write-Host ("cargo:  " + (cargo --version 2>&1))

$failed = @()
function Run-Step($name, [scriptblock]$block) {
  Write-Host ""; Write-Host "=== $name"
  & $block
  if ($LASTEXITCODE -eq 0) { Write-Host "[PASS] $name" } else { Write-Host "[FAIL] $name"; $script:failed += $name }
}

if (-not (Test-Path node_modules)) { Run-Step "npm install" { npm install } }
Run-Step "bridge tests (node, fake Tauri host)" { npm run test:bridge }
Run-Step "tsc --noEmit" { npx tsc --noEmit }
Run-Step "cargo test (ws_bridge loopback tests included)" { Push-Location src-tauri; cargo test --all-targets; $c = $LASTEXITCODE; Pop-Location; $global:LASTEXITCODE = $c }
Run-Step "cargo clippy (warnings allowed for now)" { Push-Location src-tauri; cargo clippy --all-targets; $c = $LASTEXITCODE; Pop-Location; $global:LASTEXITCODE = $c }

Write-Host ""
Write-Host "=============== RESULT"
if ($failed.Count -eq 0) { Write-Host "ALL AUTOMATED STEPS PASSED" } else { Write-Host "FAILED STEPS:"; $failed | ForEach-Object { Write-Host " - $_" } }
Write-Host ""
Write-Host "NOTE: on Windows the gateway connect path (ticket mint via gateway.sock) is unix-only by design;"
Write-Host "      the ws_bridge loopback tests above DO run here and verify the transport itself."
Stop-Transcript | Out-Null
