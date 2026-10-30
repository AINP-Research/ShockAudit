[CmdletBinding()]
param(
  [ValidateRange(1, 65535)]
  [int]$InspectorPort = 18792
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$PreviewBranch = "codex/local-chatgpt-preview"
$RepositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ExpectedVersion = [string]((Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "package.json") | ConvertFrom-Json).version)
$versionSource = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "src\version.ts")
$buildMatch = [Regex]::Match($versionSource, 'SHOCKAUDIT_UI_BUILD_LABEL\s*=\s*"([^"]+)"')
if (-not $buildMatch.Success) {
  throw "The immutable local UI build label could not be read."
}
$ExpectedUiResourceUri = "ui://shockaudit/workspace-v$($buildMatch.Groups[1].Value).html"
$HealthUrl = "http://127.0.0.1:8787/health"
$McpUrl = "http://127.0.0.1:8787/mcp"
$RuntimeDirectory = Join-Path $RepositoryRoot ".wrangler\local-preview"
$WorkerStateDirectory = Join-Path $RepositoryRoot ".wrangler\state\local-chatgpt-preview"
$WorkerPidFile = Join-Path $RuntimeDirectory "worker.pid"
$WorkerLaunchIdFile = Join-Path $RuntimeDirectory "worker.launch-id"
$WorkerOutLog = Join-Path $RuntimeDirectory "worker.stdout.log"
$WorkerErrorLog = Join-Path $RuntimeDirectory "worker.stderr.log"
# Keep the local preview on the same fail-closed host-reasoning policy as the
# checked-in Wrangler configuration. The active analysis route is the
# OpenAI-only Responses integration; this helper must not reactivate retired
# signed-host generation.
$LocalHostReasoningMode = "experimental-off"
$InspectorIp = "127.0.0.1"

function Stop-WithFriendlyError {
  param([Parameter(Mandatory = $true)][string]$Message)

  Write-Host ""
  Write-Host "LOCAL WORKER STOPPED" -ForegroundColor Red
  Write-Host $Message -ForegroundColor Red
  exit 1
}

function Get-RequiredCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$InstallHelp
  )

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    Stop-WithFriendlyError "$Name was not found. $InstallHelp"
  }
  return $command
}

function Assert-PreviewBranch {
  param([Parameter(Mandatory = $true)][string]$GitCommand)

  $branch = ((& $GitCommand rev-parse --abbrev-ref HEAD 2>$null) | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $branch -ne $PreviewBranch) {
    Stop-WithFriendlyError "Open the ShockAudit folder on branch '$PreviewBranch'. Run: git fetch origin; git switch $PreviewBranch; git pull --ff-only"
  }
}

function Assert-SafeDevCommand {
  $package = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "package.json") | ConvertFrom-Json
  $devCommand = [string]$package.scripts.dev
  if ($devCommand -notmatch "wrangler\s+dev" -or $devCommand -notmatch "npm\s+run\s+build") {
    Stop-WithFriendlyError "The npm development command no longer performs the expected local build and Wrangler start. Ask the repository maintainer to review it."
  }
  if ($devCommand -match "(?i)(wrangler\s+deploy|npm(?:\.cmd)?\s+run\s+deploy|\s--remote(?:\s|$)|\bpublish\b)") {
    Stop-WithFriendlyError "The npm development command contains a production-capable action. Nothing was started."
  }
}

function Get-LocalConfigurationIdentity {
  $varsPath = Join-Path $RepositoryRoot ".dev.vars"
  $identitySource = "missing"
  if (Test-Path -LiteralPath $varsPath) {
    $item = Get-Item -LiteralPath $varsPath
    $identitySource = "$($item.LastWriteTimeUtc.Ticks):$($item.Length)"
  }
  $sha256 = [Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes($identitySource)
    $hash = $sha256.ComputeHash($bytes)
    return "sha256:" + (($hash | ForEach-Object { $_.ToString("x2") }) -join "")
  } finally {
    $sha256.Dispose()
  }
}

function Get-ShockAuditHealth {
  try {
    return Invoke-RestMethod -Method Get -Uri $HealthUrl -TimeoutSec 5
  } catch {
    return $null
  }
}

function Test-ShockAuditHealth {
  param(
    [Parameter(Mandatory = $true)][AllowNull()]$Health,
    [Parameter(Mandatory = $true)][string]$LaunchId,
    [Parameter(Mandatory = $true)][string]$ConfigId
  )

  return (
    $null -ne $Health -and
    $Health.ok -eq $true -and
    $Health.ready -eq $true -and
    [string]$Health.service -eq "ShockAudit" -and
    [string]$Health.version -eq $ExpectedVersion -and
    [string]$Health.uiResourceUri -eq $ExpectedUiResourceUri -and
    [string]$Health.localLaunchId -ceq $LaunchId -and
    [string]$Health.localConfigId -ceq $ConfigId
  )
}

function Get-OwnedWorkerProcess {
  param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$LaunchId)

  if (-not (Test-Path -LiteralPath $WorkerPidFile) -or
      $LaunchId -notmatch '^[a-f0-9]{32}$') {
    return $null
  }
  $pidText = ((Get-Content -Raw -LiteralPath $WorkerPidFile) | Out-String).Trim()
  $pidValue = 0
  if (-not [int]::TryParse($pidText, [ref]$pidValue) -or $pidValue -le 0) {
    return $null
  }
  $process = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $pidValue" -ErrorAction SilentlyContinue
  if (-not $process) {
    return $null
  }
  $commandLine = [string]$process.CommandLine
  if ($commandLine -notmatch 'npm\.cmd\s+run\s+dev' -or
      $commandLine -notmatch '--local' -or
      $commandLine -notmatch '--port\s+8787' -or
      $commandLine -notmatch [Regex]::Escape("SHOCKAUDIT_LOCAL_LAUNCH_ID:$LaunchId")) {
    return $null
  }
  return $process
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
  throw "The MCP endpoint returned a response this helper could not read."
}

function Test-ShockAuditMcp {
  try {
    $toolBody = '{"jsonrpc":"2.0","id":"local-preview-tools-check","method":"tools/list","params":{}}'
    $toolResponse = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $McpUrl -TimeoutSec 15 -Headers @{ Accept = "application/json, text/event-stream" } -ContentType "application/json" -Body $toolBody
    if ([int]$toolResponse.StatusCode -ne 200) {
      return $false
    }
    $toolPayload = Read-McpJson -Content ([string]$toolResponse.Content)
    if ($null -ne $toolPayload.PSObject.Properties["error"]) {
      return $false
    }
    if ($null -eq $toolPayload.PSObject.Properties["result"] -or
        $null -eq $toolPayload.result.PSObject.Properties["tools"]) {
      return $false
    }
    $toolNames = @($toolPayload.result.tools | ForEach-Object { [string]$_.name })
    # Core Worker readiness should prove that ChatGPT can see the actual
    # researcher entry path. App-only internal tools and UI-resource acceptance
    # are checked separately so a presentation regression cannot kill an
    # otherwise healthy local Worker.
    return (
      $toolNames -contains "open_shockaudit_screen_1" -and
      $toolNames -contains "open_shockaudit_screen_2"
    )
  } catch {
    Write-Host "Core MCP readiness check is not complete yet: $($_.Exception.Message)" -ForegroundColor DarkGray
    return $false
  }
}

function Get-ShockAuditUiResourceStatus {
  try {
    $resourceBody = @{
      jsonrpc = "2.0"
      id = "local-preview-resource-check"
      method = "resources/read"
      params = @{ uri = $ExpectedUiResourceUri }
    } | ConvertTo-Json -Depth 4
    $resourceResponse = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $McpUrl -TimeoutSec 30 -Headers @{ Accept = "application/json, text/event-stream" } -ContentType "application/json" -Body $resourceBody
    if ([int]$resourceResponse.StatusCode -ne 200) {
      return [PSCustomObject]@{
        Ready = $false
        Reason = "resources/read returned HTTP $([int]$resourceResponse.StatusCode)."
        Length = 0
      }
    }
    $resourcePayload = Read-McpJson -Content ([string]$resourceResponse.Content)
    if ($null -ne $resourcePayload.PSObject.Properties["error"]) {
      $errorMessage = "MCP resources/read returned an error."
      if ($null -ne $resourcePayload.error -and
          $null -ne $resourcePayload.error.PSObject.Properties["message"]) {
        $errorMessage = [string]$resourcePayload.error.message
      }
      return [PSCustomObject]@{
        Ready = $false
        Reason = $errorMessage
        Length = [int]$resourceResponse.Content.Length
      }
    }
    if ($null -eq $resourcePayload.PSObject.Properties["result"] -or
        $null -eq $resourcePayload.result.PSObject.Properties["contents"]) {
      return [PSCustomObject]@{
        Ready = $false
        Reason = "resources/read returned no contents array."
        Length = [int]$resourceResponse.Content.Length
      }
    }
    $contents = @($resourcePayload.result.contents)
    if ($contents.Count -ne 1) {
      return [PSCustomObject]@{
        Ready = $false
        Reason = "resources/read returned $($contents.Count) content items instead of one."
        Length = [int]$resourceResponse.Content.Length
      }
    }
    $content = $contents[0]
    $textProperty = $content.PSObject.Properties["text"]
    $mimeProperty = $content.PSObject.Properties["mimeType"]
    if ($null -eq $textProperty -or $null -eq $mimeProperty) {
      return [PSCustomObject]@{
        Ready = $false
        Reason = "The UI resource omitted text or mimeType."
        Length = [int]$resourceResponse.Content.Length
      }
    }
    $uiText = [string]$textProperty.Value
    $mimeType = [string]$mimeProperty.Value
    $failures = @()
    if ($uiText.Length -le 1024) { $failures += "component HTML is only $($uiText.Length) characters" }
    if ($mimeType -ne "text/html;profile=mcp-app") { $failures += "mimeType is '$mimeType'" }
    if ($uiText -notmatch 'data-shockaudit-inline="js"') { $failures += "inline JS marker is missing" }
    if ($uiText -notmatch 'data-shockaudit-inline="css"') { $failures += "inline CSS marker is missing" }

    # The local build verifier proves that the private preview emits one JS
    # bundle and one stylesheet, and readUiHtml replaces those exact tags with
    # the two inline markers above. Do not scan embedded JavaScript text for
    # HTML-looking strings here: minified application strings can resemble
    # <script src=...> without causing a browser fetch. Real host delivery is
    # verified separately in ChatGPT's Network panel.
    return [PSCustomObject]@{
      Ready = ($failures.Count -eq 0)
      Reason = if ($failures.Count -eq 0) { "ready" } else { $failures -join "; " }
      Length = $uiText.Length
    }
  } catch {
    return [PSCustomObject]@{
      Ready = $false
      Reason = $_.Exception.Message
      Length = 0
    }
  }
}

function Write-ShockAuditUiResourceStatus {
  param([Parameter(Mandatory = $true)]$Status)

  if ($Status.Ready) {
    Write-Host "UI RESOURCE OK" -ForegroundColor Green
    Write-Host "The current self-contained ChatGPT component is readable ($($Status.Length) characters)."
  } else {
    Write-Host "UI RESOURCE CHECK NEEDS ATTENTION" -ForegroundColor Yellow
    Write-Host "The Worker is healthy and remains running. The interactive ChatGPT component is not yet accepted: $($Status.Reason)" -ForegroundColor Yellow
  }
}

function Get-OpenAILocalConfigurationState {
  $path = Join-Path $RepositoryRoot ".dev.vars"
  if (-not (Test-Path -LiteralPath $path)) {
    return [PSCustomObject]@{
      DirectMode = $false
      KeyPresent = $false
      ReadyForLedgerInitialization = $false
    }
  }
  $lines = @(Get-Content -LiteralPath $path)
  $mode = [bool]($lines | Where-Object {
    $_ -match '^\s*SHOCKAUDIT_SCREEN5_OPENAI_MODE\s*=\s*["'']?local-preview["'']?\s*(?:#.*)?$'
  } | Select-Object -First 1)
  $key = [bool]($lines | Where-Object {
    $_ -match '^\s*OPENAI_API_KEY\s*=\s*(?:["''][^"'']{16,4096}["'']|[^\s=#]{16,4096})\s*(?:#.*)?$'
  } | Select-Object -First 1)
  return [PSCustomObject]@{
    DirectMode = $mode
    KeyPresent = $key
    ReadyForLedgerInitialization = ($mode -and $key)
  }
}

function Write-OpenAILocalConfigurationState {
  param([Parameter(Mandatory = $true)]$State)

  Write-Host "Screen 5 OpenAI configuration presence (no inference): mode=$($State.DirectMode); key=$($State.KeyPresent). Fixed policy: provider=openai; model=gpt-6-luna; reasoning=medium; processing=Standard; store=false."
  if (-not $State.ReadyForLedgerInitialization) {
    Write-Host "OpenAI Screen 5 setup is incomplete. Run .\scripts\windows\Configure-ShockAudit-OpenAI.ps1, then restart this Worker." -ForegroundColor Yellow
  }
}

function Stop-WorkerProcessTree {
  param([Parameter(Mandatory = $true)][int]$ProcessId)

  $taskkill = Get-Command "taskkill.exe" -ErrorAction SilentlyContinue
  if ($taskkill) {
    & $taskkill.Source /PID $ProcessId /T /F *> $null
  } else {
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
  }
}

Push-Location $RepositoryRoot
try {
  Write-Host "Starting ShockAudit's local-only Wrangler server..." -ForegroundColor Cyan
  Write-Host "Local URLs: $HealthUrl and $McpUrl"

  $git = Get-RequiredCommand -Name "git.exe" -InstallHelp "Install Git for Windows and reopen PowerShell."
  $node = Get-RequiredCommand -Name "node.exe" -InstallHelp "Install Node.js 22 LTS or newer and reopen PowerShell."
  $npm = Get-RequiredCommand -Name "npm.cmd" -InstallHelp "npm is included with Node.js."
  $commandPrompt = Get-RequiredCommand -Name "cmd.exe" -InstallHelp "Windows Command Prompt is required to start npm in the background."

  $nodeVersionText = ((& $node.Source --version) | Out-String).Trim().TrimStart("v")
  try {
    $nodeVersion = [version]$nodeVersionText
  } catch {
    Stop-WithFriendlyError "Node.js reported an unreadable version. Install Node.js 22 LTS or newer."
  }
  if ($nodeVersion.Major -lt 22) {
    Stop-WithFriendlyError "Node.js $nodeVersionText is too old. Install Node.js 22 LTS or newer."
  }

  Assert-PreviewBranch -GitCommand $git.Source
  Assert-SafeDevCommand

  if (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot "node_modules"))) {
    Stop-WithFriendlyError "Dependencies are not installed. Run .\scripts\windows\Setup-ShockAudit-Local-Preview.ps1 first."
  }
  & $npm.Source ls --depth=0 --silent *> $null
  if ($LASTEXITCODE -ne 0) {
    Stop-WithFriendlyError "The local dependencies are incomplete or do not match package-lock.json. Run .\scripts\windows\Setup-ShockAudit-Local-Preview.ps1 again."
  }
  $openAIConfiguration = Get-OpenAILocalConfigurationState
  Write-OpenAILocalConfigurationState -State $openAIConfiguration

  New-Item -ItemType Directory -Force -Path $RuntimeDirectory | Out-Null
  New-Item -ItemType Directory -Force -Path $WorkerStateDirectory | Out-Null
  $configurationIdentity = Get-LocalConfigurationIdentity
  $existingLaunchId = if (Test-Path -LiteralPath $WorkerLaunchIdFile) {
    ((Get-Content -Raw -LiteralPath $WorkerLaunchIdFile) | Out-String).Trim()
  } else {
    ""
  }
  $existingHealth = Get-ShockAuditHealth
  if (
    $existingLaunchId -match '^[a-f0-9]{32}$' -and
    (Test-ShockAuditHealth -Health $existingHealth -LaunchId $existingLaunchId -ConfigId $configurationIdentity) -and
    (Test-ShockAuditMcp)
  ) {
    Write-Host ""
    Write-Host "LOCAL WORKER OK" -ForegroundColor Green
    Write-Host "The current immutable build, /health, and core /mcp entry tools are responding at $McpUrl."
    $uiResourceStatus = Get-ShockAuditUiResourceStatus
    Write-ShockAuditUiResourceStatus -Status $uiResourceStatus
    Write-Host "Open the same saved study to read the Worker-derived Screen 5 readiness and exact job authorization state."
    Write-Host "Next: open a second PowerShell window and run .\scripts\windows\Start-ShockAudit-Tunnel.ps1"
    exit 0
  }

  $ownedProcess = Get-OwnedWorkerProcess -LaunchId $existingLaunchId
  if ($null -ne $existingHealth -and $null -eq $ownedProcess) {
    Stop-WithFriendlyError "Port 8787 is responding, but the process is not the Worker recorded by this helper. Stop that process yourself; no unrelated process was killed."
  }
  if ($null -ne $ownedProcess) {
    Write-Host "Stopping the recorded stale local Worker before loading the current build and configuration..." -ForegroundColor Yellow
    Stop-WorkerProcessTree -ProcessId ([int]$ownedProcess.ProcessId)
    Start-Sleep -Seconds 1
  }
  Remove-Item -LiteralPath $WorkerPidFile, $WorkerLaunchIdFile, $WorkerOutLog, $WorkerErrorLog -Force -ErrorAction SilentlyContinue

  $launchId = [Guid]::NewGuid().ToString("N")
  $safeStateDirectory = $WorkerStateDirectory.Replace('"', '""')
  $workerCommandLine = "call npm.cmd run dev -- --local --ip 127.0.0.1 --port 8787 --inspector-ip $InspectorIp --inspector-port $InspectorPort --persist-to `"$safeStateDirectory`" --log-level info --var SHOCKAUDIT_HOST_REASONING_MODE:$LocalHostReasoningMode --var SHOCKAUDIT_LOCAL_LAUNCH_ID:$launchId --var SHOCKAUDIT_LOCAL_CONFIG_ID:$configurationIdentity"
  $arguments = @("/d", "/s", "/c", $workerCommandLine)

  Write-Host "Building the self-contained local UI, then starting Wrangler. This can take a few minutes on Windows..."
  $worker = Start-Process -FilePath $commandPrompt.Source -ArgumentList $arguments -WorkingDirectory $RepositoryRoot -PassThru -NoNewWindow -RedirectStandardOutput $WorkerOutLog -RedirectStandardError $WorkerErrorLog
  Set-Content -LiteralPath $WorkerPidFile -Value $worker.Id -Encoding Ascii
  Set-Content -LiteralPath $WorkerLaunchIdFile -Value $launchId -Encoding Ascii

  $startupStartedAt = Get-Date
  $deadline = $startupStartedAt.AddSeconds(300)
  $nextProgressMessageAt = $startupStartedAt.AddSeconds(10)
  while ((Get-Date) -lt $deadline) {
    $worker.Refresh()
    if ($worker.HasExited) {
      $errorTail = ""
      if (Test-Path -LiteralPath $WorkerErrorLog) {
        $errorTail = ((Get-Content -LiteralPath $WorkerErrorLog -Tail 20 -ErrorAction SilentlyContinue) | Out-String).Trim()
      }
      Remove-Item -LiteralPath $WorkerPidFile, $WorkerLaunchIdFile -Force -ErrorAction SilentlyContinue
      Stop-WithFriendlyError "The local server exited before it started. Review '$WorkerErrorLog'.`n$errorTail"
    }
    $now = Get-Date
    if ($now -ge $nextProgressMessageAt) {
      $elapsedSeconds = [int][Math]::Round(($now - $startupStartedAt).TotalSeconds)
      Write-Host "Still building/starting the local-only Worker... ($elapsedSeconds seconds elapsed)" -ForegroundColor DarkGray
      $nextProgressMessageAt = $now.AddSeconds(10)
    }

    $health = Get-ShockAuditHealth
    if (
      (Test-ShockAuditHealth -Health $health -LaunchId $launchId -ConfigId $configurationIdentity) -and
      (Test-ShockAuditMcp)
    ) {
      Write-Host ""
      Write-Host "LOCAL WORKER OK" -ForegroundColor Green
      Write-Host "The build succeeded, /health passed, and the core /mcp entry tools are available."
      $uiResourceStatus = Get-ShockAuditUiResourceStatus
      Write-ShockAuditUiResourceStatus -Status $uiResourceStatus
      Write-Host "Signed-host reasoning mode: $LocalHostReasoningMode"
      Write-Host "Open the same saved study to read the Worker-derived Screen 5 readiness and exact job authorization state."
      Write-Host "Keep this process running. Next, open a second PowerShell window and run .\scripts\windows\Start-ShockAudit-Tunnel.ps1"
      exit 0
    }
    Start-Sleep -Seconds 2
  }

  Stop-WorkerProcessTree -ProcessId $worker.Id
  Remove-Item -LiteralPath $WorkerPidFile, $WorkerLaunchIdFile -Force -ErrorAction SilentlyContinue
  Stop-WithFriendlyError "The server did not pass the local build, /health, and core /mcp entry-tool checks within five minutes. Review '$WorkerOutLog' and '$WorkerErrorLog', then run this helper again."
} catch {
  Stop-WithFriendlyError $_.Exception.Message
} finally {
  Pop-Location
}
