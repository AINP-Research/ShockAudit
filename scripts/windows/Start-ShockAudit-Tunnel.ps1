[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$PreviewBranch = "codex/local-chatgpt-preview"
$TunnelId = "tunnel_6aad607472bc81919f2e4caa13eec606"
$McpUrl = "http://127.0.0.1:8787/mcp"
$HealthUrl = "http://127.0.0.1:8787/health"
$ProfileName = "shockaudit-local"
$RepositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$RuntimeDirectory = Join-Path $RepositoryRoot ".wrangler\local-preview"
$ProfileDirectory = Join-Path $RuntimeDirectory "tunnel-profiles"
$TunnelPidFile = Join-Path $RuntimeDirectory "tunnel.pid"
$TunnelHealthUrlFile = Join-Path $RuntimeDirectory "tunnel-health.url"
$TunnelOutLog = Join-Path $RuntimeDirectory "tunnel.stdout.log"
$TunnelErrorLog = Join-Path $RuntimeDirectory "tunnel.stderr.log"

function Stop-WithFriendlyError {
  param([Parameter(Mandatory = $true)][string]$Message)

  Write-Host ""
  Write-Host "TUNNEL STOPPED" -ForegroundColor Red
  Write-Host $Message -ForegroundColor Red
  exit 1
}

function Read-McpJson {
  param([Parameter(Mandatory = $true)][string]$Content)

  $trimmed = $Content.Trim()
  if ($trimmed.StartsWith("{")) {
    return $trimmed | ConvertFrom-Json
  }
  foreach ($line in ($Content -split "`r?`n")) {
    if ($line.StartsWith("data:")) {
      $candidate = $line.Substring(5).Trim()
      if ($candidate.StartsWith("{")) {
        return $candidate | ConvertFrom-Json
      }
    }
  }
  throw "The MCP response was not readable JSON or server-sent-event JSON."
}

function Test-ShockAuditWorker {
  try {
    $health = Invoke-RestMethod -Method Get -Uri $HealthUrl -TimeoutSec 5
    if ($health.ok -ne $true -or $health.ready -ne $true -or [string]$health.service -ne "ShockAudit") {
      return $false
    }
    $body = '{"jsonrpc":"2.0","id":"tunnel-preflight","method":"tools/list","params":{}}'
    $response = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $McpUrl -TimeoutSec 15 -Headers @{ Accept = "application/json, text/event-stream" } -ContentType "application/json" -Body $body
    $payload = Read-McpJson -Content ([string]$response.Content)
    $toolNames = @($payload.result.tools | ForEach-Object { [string]$_.name })
    return ([int]$response.StatusCode -eq 200 -and $toolNames -contains "open_shockaudit_screen_1")
  } catch {
    return $false
  }
}

function Test-TunnelReadiness {
  if (-not (Test-Path -LiteralPath $TunnelHealthUrlFile)) {
    return $false
  }
  $baseUrl = (((Get-Content -Raw -LiteralPath $TunnelHealthUrlFile -ErrorAction SilentlyContinue) | Out-String).Trim()).TrimEnd("/")
  if ([string]::IsNullOrWhiteSpace($baseUrl)) {
    return $false
  }
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Method Get -Uri "$baseUrl/readyz" -TimeoutSec 5
    return [int]$response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Get-RecordedTunnelProcess {
  if (-not (Test-Path -LiteralPath $TunnelPidFile)) {
    return $null
  }
  $pidText = ((Get-Content -Raw -LiteralPath $TunnelPidFile -ErrorAction SilentlyContinue) | Out-String).Trim()
  $processId = 0
  if (-not [int]::TryParse($pidText, [ref]$processId) -or $processId -le 0) {
    return $null
  }
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if (-not $process -or $process.ProcessName -notlike "tunnel-client*") {
    return $null
  }
  return $process
}

function Write-Success {
  $adminBaseUrl = (Get-Content -Raw -LiteralPath $TunnelHealthUrlFile).Trim().TrimEnd("/")
  Write-Host ""
  Write-Host "READY: ShockAudit local Worker and Secure MCP Tunnel are usable." -ForegroundColor Green
  Write-Host "Tunnel ID: $TunnelId"
  Write-Host "Local MCP target: $McpUrl"
  Write-Host "Tunnel status page: $adminBaseUrl/ui"
  Write-Host "Keep both local processes running while you use the ChatGPT app."
}

Push-Location $RepositoryRoot
try {
  Write-Host "Starting the OpenAI Secure MCP Tunnel for ShockAudit..." -ForegroundColor Cyan

  $git = Get-Command "git.exe" -ErrorAction SilentlyContinue
  if (-not $git) {
    Stop-WithFriendlyError "Git for Windows was not found. Install it and reopen PowerShell."
  }
  $branch = ((& $git.Source rev-parse --abbrev-ref HEAD 2>$null) | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $branch -ne $PreviewBranch) {
    Stop-WithFriendlyError "This helper only runs on '$PreviewBranch'. Switch with: git fetch origin; git switch $PreviewBranch; git pull --ff-only"
  }

  if (-not (Test-ShockAuditWorker)) {
    Stop-WithFriendlyError "ShockAudit is not responding correctly at $McpUrl. Run .\scripts\windows\Start-ShockAudit-Local-Preview.ps1 first and leave it running."
  }

  $tunnelCommand = Get-Command "tunnel-client.exe" -ErrorAction SilentlyContinue
  if (-not $tunnelCommand) {
    $tunnelCommand = Get-Command "tunnel-client" -ErrorAction SilentlyContinue
  }
  if (-not $tunnelCommand) {
    Stop-WithFriendlyError "tunnel-client was not found. Download the latest Windows tunnel-client from OpenAI Platform Tunnels, put tunnel-client.exe in a folder on PATH, then reopen PowerShell."
  }

  New-Item -ItemType Directory -Force -Path $RuntimeDirectory | Out-Null
  New-Item -ItemType Directory -Force -Path $ProfileDirectory | Out-Null

  $recordedTunnel = Get-RecordedTunnelProcess
  if ($recordedTunnel -and (Test-TunnelReadiness)) {
    Write-Success
    exit 0
  }

  if ($recordedTunnel) {
    Stop-Process -Id $recordedTunnel.Id -Force -ErrorAction SilentlyContinue
  }

  Remove-Item -LiteralPath $TunnelPidFile, $TunnelHealthUrlFile, $TunnelOutLog, $TunnelErrorLog -Force -ErrorAction SilentlyContinue

  Write-Host "Preparing a local no-auth HTTP profile for this one repository..."
  & $tunnelCommand.Source init --sample sample_mcp_remote_no_auth --profile $ProfileName --profile-dir $ProfileDirectory --force --tunnel-id $TunnelId --mcp-server-url $McpUrl --health-listen-addr "127.0.0.1:0"
  if ($LASTEXITCODE -ne 0) {
    Stop-WithFriendlyError "tunnel-client could not prepare its local profile. Install the latest tunnel-client and try again. No key was stored."
  }

  Write-Host ""
  Write-Host "Paste your OpenAI tunnel runtime API key at the hidden prompt." -ForegroundColor Yellow
  Write-Host "The key will not be displayed, written to a file, or added to Git."
  $secureKey = Read-Host -Prompt "OpenAI tunnel runtime API key" -AsSecureString
  $keyPointer = [IntPtr]::Zero
  $plainKey = $null
  $tunnelProcess = $null
  $launchError = $null

  try {
    $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
    if ([string]::IsNullOrWhiteSpace($plainKey)) {
      throw "No runtime API key was entered."
    }

    [Environment]::SetEnvironmentVariable("CONTROL_PLANE_API_KEY", $plainKey, "Process")

    Write-Host ""
    Write-Host "Running tunnel-client doctor before starting the tunnel..." -ForegroundColor Cyan
    & $tunnelCommand.Source doctor --profile $ProfileName --profile-dir $ProfileDirectory --explain
    if ($LASTEXITCODE -ne 0) {
      throw "tunnel-client doctor found a problem. Read its explanation above, fix that item, and run this helper again."
    }

    $runArguments = @(
      "run",
      "--profile", $ProfileName,
      "--profile-dir", ('"' + $ProfileDirectory.Replace('"', '\"') + '"'),
      "--health.listen-addr", "127.0.0.1:0",
      "--health.url-file", ('"' + $TunnelHealthUrlFile.Replace('"', '\"') + '"')
    )
    $tunnelProcess = Start-Process -FilePath $tunnelCommand.Source -ArgumentList $runArguments -WorkingDirectory $RepositoryRoot -PassThru -NoNewWindow -RedirectStandardOutput $TunnelOutLog -RedirectStandardError $TunnelErrorLog
    Set-Content -LiteralPath $TunnelPidFile -Value $tunnelProcess.Id -Encoding Ascii
  } catch {
    $launchError = $_.Exception.Message
  } finally {
    [Environment]::SetEnvironmentVariable("CONTROL_PLANE_API_KEY", $null, "Process")
    $plainKey = $null
    if ($keyPointer -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
    }
    $secureKey.Dispose()
  }

  if ($launchError) {
    Stop-WithFriendlyError "$launchError The runtime API key was discarded."
  }

  Write-Host "Waiting for the tunnel to become usable..."
  $deadline = (Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $deadline) {
    $tunnelProcess.Refresh()
    if ($tunnelProcess.HasExited) {
      $errorTail = ""
      if (Test-Path -LiteralPath $TunnelErrorLog) {
        $errorTail = ((Get-Content -LiteralPath $TunnelErrorLog -Tail 20 -ErrorAction SilentlyContinue) | Out-String).Trim()
      }
      Remove-Item -LiteralPath $TunnelPidFile -Force -ErrorAction SilentlyContinue
      Stop-WithFriendlyError "The tunnel exited before becoming usable. Review '$TunnelErrorLog'.`n$errorTail"
    }
    if ((Test-ShockAuditWorker) -and (Test-TunnelReadiness)) {
      Write-Success
      exit 0
    }
    Start-Sleep -Seconds 2
  }

  Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $TunnelPidFile -Force -ErrorAction SilentlyContinue
  Stop-WithFriendlyError "The tunnel did not pass its local /readyz check within 90 seconds. Review '$TunnelErrorLog', then try again."
} catch {
  Stop-WithFriendlyError $_.Exception.Message
} finally {
  Pop-Location
}
