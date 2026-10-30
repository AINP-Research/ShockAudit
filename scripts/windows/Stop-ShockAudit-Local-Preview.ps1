[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$RuntimeDirectory = Join-Path $RepositoryRoot ".wrangler\local-preview"
$PidFiles = @(
  @{
    Label = "Secure MCP Tunnel"
    Path = (Join-Path $RuntimeDirectory "tunnel.pid")
    ExpectedCommand = 'tunnel-client(?:\.exe)?"?\s+run\b.*--profile\s+shockaudit-local'
  },
  @{
    Label = "local Wrangler server"
    Path = (Join-Path $RuntimeDirectory "worker.pid")
    ExpectedCommand = "npm\.cmd\s+run\s+dev\s+--\s+--local\b.*--port\s+8787"
  }
)

function Stop-RecordedProcessTree {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$PidFile,
    [Parameter(Mandatory = $true)][string]$ExpectedCommand
  )

  if (-not (Test-Path -LiteralPath $PidFile)) {
    Write-Host "${Label}: no process recorded."
    return
  }

  $pidText = ((Get-Content -Raw -LiteralPath $PidFile) | Out-String).Trim()
  $processId = 0
  if (-not [int]::TryParse($pidText, [ref]$processId) -or $processId -le 0) {
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    Write-Host "${Label}: removed an invalid local PID record."
    return
  }

  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if ($process) {
    $processDetails = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
    $commandLine = ""
    if ($processDetails) {
      $commandLine = [string]$processDetails.CommandLine
    }
    if ([string]::IsNullOrWhiteSpace($commandLine) -or $commandLine -notmatch $ExpectedCommand) {
      Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
      Write-Host "${Label}: the recorded PID now belongs to a different program, so it was not stopped." -ForegroundColor Yellow
      return
    }
    $taskkill = Get-Command "taskkill.exe" -ErrorAction SilentlyContinue
    if ($taskkill) {
      & $taskkill.Source /PID $processId /T /F *> $null
    } else {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
    Write-Host "${Label}: stopped."
  } else {
    Write-Host "${Label}: it had already stopped."
  }
  Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
}

Write-Host "Stopping only the local ShockAudit preview processes..." -ForegroundColor Cyan
foreach ($entry in $PidFiles) {
  Stop-RecordedProcessTree -Label $entry.Label -PidFile $entry.Path -ExpectedCommand $entry.ExpectedCommand
}

Remove-Item -LiteralPath (Join-Path $RuntimeDirectory "tunnel-health.url") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $RuntimeDirectory "worker.launch-id") -Force -ErrorAction SilentlyContinue
Write-Host "LOCAL PREVIEW STOPPED" -ForegroundColor Green
Write-Host "No deployed Worker, route, or production storage was changed."
