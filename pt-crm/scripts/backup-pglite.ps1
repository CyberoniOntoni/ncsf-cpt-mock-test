# Backup local PGlite data directory (Windows pilot).
# Prefer stopping the dev server first so the copy is consistent.
#
# Usage (from pt-crm/):
#   powershell -ExecutionPolicy Bypass -File scripts/backup-pglite.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/backup-pglite.ps1 -Dest D:\backups\floorscribe
#
param(
  [string]$Dest = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$DataDir = if ($env:PGLITE_DATA_DIR) { $env:PGLITE_DATA_DIR } else { Join-Path $Root "data\pglite" }

if (-not (Test-Path $DataDir)) {
  Write-Error "PGlite data dir not found: $DataDir"
}

if (-not $Dest) {
  $Dest = Join-Path $Root "backups"
}
New-Item -ItemType Directory -Force -Path $Dest | Out-Null

$Stamp = Get-Date -Format "yyyyMMddTHHmmss"
$Out = Join-Path $Dest "pglite-$Stamp.zip"

Write-Host "Backing up $DataDir → $Out"

# PGlite ships some files with 1970 timestamps; Compress-Archive rejects those.
# Copy to temp, normalize timestamps, then zip.
$Tmp = Join-Path $env:TEMP "floorscribe-pglite-$Stamp"
if (Test-Path $Tmp) { Remove-Item $Tmp -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Tmp | Out-Null

try {
  # Robocopy is more reliable with locked/open files than Copy-Item
  $null = & robocopy $DataDir $Tmp /E /R:1 /W:1 /NFL /NDL /NJH /NJS /nc /ns /np
  # robocopy exit codes 0-7 are success-ish
  if ($LASTEXITCODE -ge 8) {
    Write-Error "robocopy failed with exit $LASTEXITCODE"
  }

  $now = Get-Date
  Get-ChildItem $Tmp -Recurse -Force | ForEach-Object {
    try {
      $_.LastWriteTime = $now
      $_.CreationTime = $now
      $_.LastAccessTime = $now
    } catch { }
  }

  if (Test-Path $Out) { Remove-Item $Out -Force }

  # Prefer System32 tar (MS tar); Git Bash tar mis-parses drive letters
  $winTar = Join-Path $env:SystemRoot "System32\tar.exe"
  if (Test-Path $winTar) {
    Push-Location $Tmp
    try {
      & $winTar -a -c -f $Out *
      if ($LASTEXITCODE -ne 0) { throw "tar exit $LASTEXITCODE" }
    } finally {
      Pop-Location
    }
  } else {
    Compress-Archive -Path (Join-Path $Tmp "*") -DestinationPath $Out -Force
  }

  if (-not (Test-Path $Out)) {
    Write-Error "Backup file was not created: $Out"
  }

  $size = (Get-Item $Out).Length
  Write-Host ("OK: {0} ({1:N1} MB)" -f $Out, ($size / 1MB))
} finally {
  if (Test-Path $Tmp) {
    Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# Retain last 14 backups
Get-ChildItem $Dest -Filter "pglite-*.zip" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip 14 |
  ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue }

Write-Host "Tip: stop npm run dev before backup for the cleanest snapshot."
