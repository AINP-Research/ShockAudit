[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-f]{40}$')]
  [string]$ExpectedCommit,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-f]{40}$')]
  [string]$ExpectedTree,

  [ValidateRange(1, 65535)]
  [int]$WorkerPort = 8794,

  [ValidateRange(1, 65535)]
  [int]$InspectorPort = 18794
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$PreviewBranch = "codex/local-chatgpt-preview"
$HealthUrl = "http://127.0.0.1:$WorkerPort/health"
$McpUrl = "http://127.0.0.1:$WorkerPort/mcp"
$StartHelper = Join-Path $PSScriptRoot "Start-ShockAudit-Local-Preview.ps1"
$StopHelper = Join-Path $PSScriptRoot "Stop-ShockAudit-Local-Preview.ps1"
$TunnelHelper = Join-Path $PSScriptRoot "Start-ShockAudit-Tunnel.ps1"
$AllowedMcpMethods = @("tools/list", "resources/read")
$ControlledRuntimeDirectory = $null
$ControlledWorker = $null
$ControlledRunId = $null
$wranglerCli = $null
$FailureMessage = $null
$ProcessEnvironmentIsolated = $false
$SavedProcessEnvironment = @{}
$CredentialEnvironmentNames = @(
  "CLOUDFLARE_INCLUDE_PROCESS_ENV",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_API_KEY",
  "CLOUDFLARE_EMAIL",
  "CLOUDFLARE_ACCOUNT_ID",
  "CONTROL_PLANE_API_KEY",
  "OPENAI_API_KEY",
  "GOVINFO_API_KEY",
  "CONGRESS_API_KEY",
  "REGULATIONS_API_KEY",
  "LEGISCAN_API_KEY",
  "TAVILY_API_KEY",
  "BRAVE_API_KEY",
  "OPENALEX_API_KEY"
)

function Stop-WithFriendlyError {
  param([Parameter(Mandatory = $true)][string]$Message)

  throw [InvalidOperationException]::new($Message)
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

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$Description,
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  Write-Host ""
  Write-Host $Description -ForegroundColor Cyan
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    Stop-WithFriendlyError "$Description failed. Read the command output above; no tunnel or live analysis was started."
  }
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
  throw "The MCP endpoint returned neither JSON nor readable server-sent-event JSON."
}

function Invoke-ReadOnlyMcp {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)]$Params,
    [Parameter(Mandatory = $true)][string]$RequestId
  )

  if ($AllowedMcpMethods -notcontains $Method) {
    throw "The integrated repair verifier refuses consequential MCP method '$Method'."
  }
  $body = @{
    jsonrpc = "2.0"
    id = $RequestId
    method = $Method
    params = $Params
  } | ConvertTo-Json -Compress -Depth 8
  $response = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $McpUrl `
    -TimeoutSec 30 `
    -Headers @{ Accept = "application/json, text/event-stream" } `
    -ContentType "application/json" `
    -Body $body
  if ([int]$response.StatusCode -ne 200) {
    throw "The MCP endpoint returned HTTP $([int]$response.StatusCode) for the read-only '$Method' check."
  }
  return Read-McpJson -Content ([string]$response.Content)
}

function Get-RequiredLiteral {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Pattern,
    [Parameter(Mandatory = $true)][string]$Label
  )

  $source = Get-Content -Raw -LiteralPath $Path
  $match = [Regex]::Match($source, $Pattern)
  if (-not $match.Success) {
    throw "The expected $Label literal could not be read from the checked-out source."
  }
  return [string]$match.Groups[1].Value
}

function Get-Sha256Identity {
  param([Parameter(Mandatory = $true)][string]$Value)

  $sha256 = [Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
    $hash = $sha256.ComputeHash($bytes)
    return "sha256:" + (($hash | ForEach-Object { $_.ToString("x2") }) -join "")
  } finally {
    $sha256.Dispose()
  }
}

function Stop-ControlledWorker {
  param(
    [AllowNull()]$Process,
    [AllowNull()][string]$RunId,
    [AllowNull()][string]$RuntimeDirectory,
    [AllowNull()][string]$WranglerCli,
    [int]$ExpectedWorkerPort,
    [int]$ExpectedInspectorPort
  )

  if ($null -eq $Process) {
    return
  }
  $Process.Refresh()
  if ($Process.HasExited) {
    return
  }
  $details = Get-CimInstance -ClassName Win32_Process `
    -Filter "ProcessId = $($Process.Id)" -ErrorAction SilentlyContinue
  $commandLine = if ($details) { [string]$details.CommandLine } else { "" }
  $owned = (
    -not [string]::IsNullOrWhiteSpace($commandLine) -and
    -not [string]::IsNullOrWhiteSpace($RunId) -and
    -not [string]::IsNullOrWhiteSpace($RuntimeDirectory) -and
    -not [string]::IsNullOrWhiteSpace($WranglerCli) -and
    $commandLine -match [Regex]::Escape([IO.Path]::GetFullPath($WranglerCli)) -and
    $commandLine -match '(?:^|\s)dev(?:\s|$)' -and
    $commandLine -match '(?:^|\s)--local(?:\s|$)' -and
    $commandLine -match "--port\s+$ExpectedWorkerPort(?:\s|$)" -and
    $commandLine -match "--inspector-port\s+$ExpectedInspectorPort(?:\s|$)" -and
    $commandLine -match [Regex]::Escape([IO.Path]::GetFullPath((Join-Path $RuntimeDirectory "state"))) -and
    $commandLine -match [Regex]::Escape("SHOCKAUDIT_LOCAL_LAUNCH_ID:$RunId")
  )
  if (-not $owned) {
    throw "The controlled Worker PID no longer has the exact launch identity; it was not stopped."
  }
  $taskkill = Get-Command "taskkill.exe" -ErrorAction SilentlyContinue
  if ($taskkill) {
    & $taskkill.Source /PID $Process.Id /T /F *> $null
  } else {
    Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
  }
  if (-not $Process.WaitForExit(10000)) {
    throw "The exact controlled Worker process did not exit after cleanup."
  }
}

function Remove-ControlledRuntimeDirectory {
  param([AllowNull()][string]$Path)

  if ([string]::IsNullOrWhiteSpace($Path) -or
      -not (Test-Path -LiteralPath $Path)) {
    return
  }
  $fullPath = [IO.Path]::GetFullPath($Path)
  $temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  $leaf = Split-Path -Leaf $fullPath
  if (-not $fullPath.StartsWith($temporaryRoot, [StringComparison]::OrdinalIgnoreCase) -or
      $leaf -notmatch '^ShockAudit-IntegratedRepair-[a-f0-9]{32}$') {
    throw "Refusing to remove an unverified controlled-runtime directory."
  }
  Remove-Item -LiteralPath $fullPath -Recurse -Force
}

Push-Location $RepositoryRoot
try {
  Write-Host "ShockAudit integrated local-repair verification" -ForegroundColor Cyan
  Write-Host "This run uses isolated temporary persistence and a credential-free environment."
  Write-Host "It permits only /health, tools/list, resources/read, and UI asset GETs; it does not invoke a workflow action, source search, model request, tunnel, deployment, or browser installation."

  $git = Get-RequiredCommand -Name "git.exe" -InstallHelp "Install Git for Windows and reopen PowerShell."
  $node = Get-RequiredCommand -Name "node.exe" -InstallHelp "Install Node.js 22 LTS or newer and reopen PowerShell."
  $npm = Get-RequiredCommand -Name "npm.cmd" -InstallHelp "npm is included with Node.js."

  if ($WorkerPort -eq $InspectorPort) {
    Stop-WithFriendlyError "WorkerPort and InspectorPort must be different loopback ports."
  }

  foreach ($helper in @($StartHelper, $StopHelper, $TunnelHelper)) {
    if (-not (Test-Path -LiteralPath $helper)) {
      Stop-WithFriendlyError "The existing local start/stop/tunnel workflow is incomplete: '$helper' is missing."
    }
  }

  $nodeVersionText = ((& $node.Source --version) | Out-String).Trim().TrimStart("v")
  try {
    $nodeVersion = [version]$nodeVersionText
  } catch {
    Stop-WithFriendlyError "Node.js reported version '$nodeVersionText'. Install Node.js 22 LTS or newer."
  }
  if ($nodeVersion.Major -lt 22) {
    Stop-WithFriendlyError "Node.js $nodeVersionText is too old. Install Node.js 22 LTS or newer."
  }

  $branch = ((& $git.Source branch --show-current 2>$null) | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $branch -ne $PreviewBranch) {
    Stop-WithFriendlyError "Open the ShockAudit checkout on branch '$PreviewBranch'. Do not run this against main."
  }
  $worktreeChanges = ((& $git.Source status --porcelain=v1 --untracked-files=all) | Out-String).Trim()
  if ($LASTEXITCODE -ne 0) {
    Stop-WithFriendlyError "Git could not inspect the worktree."
  }
  if (-not [string]::IsNullOrWhiteSpace($worktreeChanges)) {
    Stop-WithFriendlyError "The worktree has unpreserved changes. Save or commit them before verifying; this helper will not reset, clean, or overwrite them."
  }
  $head = ((& $git.Source rev-parse HEAD) | Out-String).Trim()
  $tree = ((& $git.Source rev-parse "HEAD^{tree}") | Out-String).Trim()
  if ($head -cne $ExpectedCommit -or $tree -cne $ExpectedTree) {
    Stop-WithFriendlyError "This checkout is commit $head (tree $tree), not the approved candidate $ExpectedCommit (tree $ExpectedTree). Stop rather than testing or tunneling the wrong source."
  }
  $remotePreviewRef = "refs/remotes/origin/$PreviewBranch"
  $remoteHead = ((& $git.Source rev-parse --verify $remotePreviewRef 2>$null) | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($remoteHead)) {
    Stop-WithFriendlyError "The fetched preview ref is unavailable. Run 'git fetch origin', inspect any local work, and use a non-destructive fast-forward before retrying."
  }
  if ($remoteHead -cne $ExpectedCommit) {
    Stop-WithFriendlyError "The fetched preview ref is $remoteHead, not approved commit $ExpectedCommit. Stop: the local and published preview histories are not aligned."
  }

  if (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot "node_modules"))) {
    Stop-WithFriendlyError "Dependencies are missing. Run .\scripts\windows\Setup-ShockAudit-Local-Preview.ps1 first; it preserves .dev.vars and .wrangler state."
  }

  $expectedVersion = [string]((Get-Content -Raw -LiteralPath `
    (Join-Path $RepositoryRoot "package.json") | ConvertFrom-Json).version)
  $uiBuildLabel = Get-RequiredLiteral `
    -Path (Join-Path $RepositoryRoot "src\version.ts") `
    -Pattern 'SHOCKAUDIT_UI_BUILD_LABEL\s*=\s*\r?\n?\s*"([^"]+)"' `
    -Label "UI build"
  $responseBuild = Get-RequiredLiteral `
    -Path (Join-Path $RepositoryRoot "src\core\six-screen\workflow-response-contract.ts") `
    -Pattern 'SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID\s*=\s*\r?\n?\s*"([^"]+)"' `
    -Label "workflow response build"
  $expectedUiResourceUri = "ui://shockaudit/workspace-v$uiBuildLabel.html"

  foreach ($name in $CredentialEnvironmentNames) {
    $SavedProcessEnvironment[$name] = `
      [Environment]::GetEnvironmentVariable($name, "Process")
  }
  $ProcessEnvironmentIsolated = $true
  foreach ($name in $CredentialEnvironmentNames) {
    $replacement = if ($name -eq "CLOUDFLARE_INCLUDE_PROCESS_ENV") {
      "false"
    } else {
      $null
    }
    [Environment]::SetEnvironmentVariable($name, $replacement, "Process")
  }

  Invoke-Checked -Description "Running the full automated test suite..." `
    -Command $npm.Source -Arguments @("run", "test", "--", "--maxWorkers=2")
  Invoke-Checked -Description "Building and type-checking the exact candidate..." `
    -Command $npm.Source -Arguments @("run", "build")
  Invoke-Checked -Description "Running the repository release guards..." `
    -Command $npm.Source -Arguments @("run", "check:release-gates")
  Invoke-Checked -Description "Enumerating the complete browser gate without launching or installing a browser..." `
    -Command $npm.Source -Arguments @("run", "test:browser:list")

  $inventory = Get-Content -Raw -LiteralPath `
    (Join-Path $RepositoryRoot "tests\browser\release-gate-inventory.json") | ConvertFrom-Json
  if (@($inventory.tests).Count -ne 60) {
    Stop-WithFriendlyError "The checked-in browser inventory contains $(@($inventory.tests).Count) tests; the integrated repair handoff expects the exact 60-test discovery inventory."
  }
  $postGateChanges = ((& $git.Source status --porcelain=v1 --untracked-files=all) | Out-String).Trim()
  $postGateHead = ((& $git.Source rev-parse HEAD) | Out-String).Trim()
  $postGateTree = ((& $git.Source rev-parse "HEAD^{tree}") | Out-String).Trim()
  if (
    -not [string]::IsNullOrWhiteSpace($postGateChanges) -or
    $postGateHead -cne $ExpectedCommit -or
    $postGateTree -cne $ExpectedTree
  ) {
    Stop-WithFriendlyError "The automated gates changed the worktree or candidate identity. Preserve and inspect that change before any local connection."
  }

  Write-Host ""
  Write-Host "Starting an isolated credential-free local Worker..." -ForegroundColor Cyan
  $ControlledRunId = [Guid]::NewGuid().ToString("N")
  $ControlledRuntimeDirectory = Join-Path ([IO.Path]::GetTempPath()) `
    "ShockAudit-IntegratedRepair-$ControlledRunId"
  $controlledState = Join-Path $ControlledRuntimeDirectory "state"
  $controlledEnvironment = Join-Path $ControlledRuntimeDirectory "offline.env"
  $controlledOutLog = Join-Path $ControlledRuntimeDirectory "worker.stdout.log"
  $controlledErrorLog = Join-Path $ControlledRuntimeDirectory "worker.stderr.log"
  $wranglerCli = Join-Path $RepositoryRoot "node_modules\wrangler\bin\wrangler.js"
  if (-not (Test-Path -LiteralPath $wranglerCli)) {
    Stop-WithFriendlyError "The lockfile-installed Wrangler CLI is missing. Run the existing setup helper before retrying."
  }
  New-Item -ItemType Directory -Force -Path $controlledState | Out-Null
  Set-Content -LiteralPath $controlledEnvironment -Encoding Ascii -Value `
    "# Intentionally empty: integrated repair verification loads no credentials."

  $configurationIdentity = Get-Sha256Identity `
    -Value "shockaudit-integrated-repair-offline-v1:$ExpectedCommit:$ExpectedTree"
  $workerArguments = @(
    ('"' + $wranglerCli.Replace('"', '\"') + '"'),
    "dev",
    "--config", ('"' + (Join-Path $RepositoryRoot "wrangler.jsonc").Replace('"', '\"') + '"'),
    "--local",
    "--ip", "127.0.0.1",
    "--port", [string]$WorkerPort,
    "--inspector-ip", "127.0.0.1",
    "--inspector-port", [string]$InspectorPort,
    "--persist-to", ('"' + $controlledState.Replace('"', '\"') + '"'),
    "--env-file", ('"' + $controlledEnvironment.Replace('"', '\"') + '"'),
    "--log-level", "info",
    "--var", "SCREEN02_SEARCH_EXPANSION_MODE:off",
    "--var", "SCREEN02_PUBLIC_EVENT_INDEX_MODE:off",
    "--var", "SCREEN03_HOST_NATIVE_DEFAULT:off",
    "--var", "SHOCKAUDIT_HOST_REASONING_MODE:experimental-off",
    "--var", "SHOCKAUDIT_SCREEN5_OPENAI_MODE:off",
    "--var", "SHOCKAUDIT_LOCAL_LAUNCH_ID:$ControlledRunId",
    "--var", "SHOCKAUDIT_LOCAL_CONFIG_ID:$configurationIdentity"
  )
  $ControlledWorker = Start-Process -FilePath $node.Source `
    -ArgumentList $workerArguments `
    -WorkingDirectory $RepositoryRoot `
    -PassThru `
    -NoNewWindow `
    -RedirectStandardOutput $controlledOutLog `
    -RedirectStandardError $controlledErrorLog

  $health = $null
  $deadline = (Get-Date).AddSeconds(120)
  while ((Get-Date) -lt $deadline) {
    $ControlledWorker.Refresh()
    if ($ControlledWorker.HasExited) {
      $errorTail = ((Get-Content -LiteralPath $controlledErrorLog -Tail 30 `
        -ErrorAction SilentlyContinue) | Out-String).Trim()
      Stop-WithFriendlyError "The isolated local Worker exited before readiness. $errorTail"
    }
    try {
      $health = Invoke-RestMethod -Method Get -Uri $HealthUrl -TimeoutSec 5
    } catch {
      $health = $null
    }
    if ($null -ne $health -and $health.ready -eq $true) {
      break
    }
    Start-Sleep -Seconds 2
  }
  if (
    $null -eq $health -or
    $health.ok -ne $true -or
    $health.ready -ne $true -or
    [string]$health.service -cne "ShockAudit" -or
    [string]$health.version -cne $expectedVersion -or
    [string]$health.readiness.mode -cne "integrated" -or
    [string]$health.readiness.mcpRuntime -cne "durable-object" -or
    [string]$health.capabilities.intelligence.configuredMode -cne "experimental-off" -or
    $health.capabilities.intelligence.modelCallable -ne $false -or
    [string]$health.uiResourceUri -cne $expectedUiResourceUri -or
    [string]$health.localLaunchId -cne $ControlledRunId -or
    [string]$health.localConfigId -cne $configurationIdentity
  ) {
    Stop-WithFriendlyError "The served backend health identity does not match the exact checked-out UI resource '$expectedUiResourceUri'."
  }

  $toolPayload = Invoke-ReadOnlyMcp -Method "tools/list" -Params @{} `
    -RequestId "integrated-repair-tools"
  $toolNames = @($toolPayload.result.tools | ForEach-Object { [string]$_.name })
  foreach ($requiredTool in @(
    "open_shockaudit_screen_1",
    "get_six_screen_workflow_v1",
    "get_six_screen_operation_status_v1",
    "get_six_screen_recovery_snapshot_v1",
    "mutate_six_screen_workflow_v1"
  )) {
    if ($toolNames -notcontains $requiredTool) {
      Stop-WithFriendlyError "The served backend omitted required tool '$requiredTool'."
    }
  }
  if (
    $toolNames -contains "submit_screen04_study_event_assessment" -or
    $toolNames -contains "submit_screen05_theoretical_planning" -or
    $toolNames -contains "submit_screen05_study_mechanism_comparison"
  ) {
    Stop-WithFriendlyError "The served backend exposed a retired signed-host generation tool."
  }

  $resourcePayload = Invoke-ReadOnlyMcp -Method "resources/read" `
    -Params @{ uri = $expectedUiResourceUri } `
    -RequestId "integrated-repair-resource"
  $resource = @($resourcePayload.result.contents)[0]
  if (
    $null -eq $resource -or
    [string]$resource.uri -cne $expectedUiResourceUri -or
    [string]$resource.mimeType -cne "text/html;profile=mcp-app"
  ) {
    Stop-WithFriendlyError "The backend did not serve the expected current MCP App resource."
  }
  $hostReasoningProperty = `
    $resource._meta.PSObject.Properties["shockaudit/hostReasoning"]
  $hostReasoning = if ($null -eq $hostReasoningProperty) {
    $null
  } else {
    $hostReasoningProperty.Value
  }
  if (
    $null -eq $hostReasoning -or
    [string]$hostReasoning.mode -cne "experimental-off" -or
    $hostReasoning.enabled -ne $false
  ) {
    Stop-WithFriendlyError "The served MCP App resource did not keep signed-host reasoning experimental-off."
  }

  $html = [string]$resource.text
  if ($html -notmatch '<div id="root">') {
    Stop-WithFriendlyError "The current MCP App resource did not contain the application root."
  }
  $scriptMatch = [Regex]::Match(
    $html,
    'https?://[^"''\s]+/assets/shockaudit-app\.js\?v=[^"''\s]+'
  )
  $styleMatch = [Regex]::Match(
    $html,
    'https?://[^"''\s]+/assets/shockaudit-app\.css\?v=[^"''\s]+'
  )
  if (-not $scriptMatch.Success -or -not $styleMatch.Success) {
    Stop-WithFriendlyError "The current MCP App resource did not reference its versioned script and stylesheet."
  }
  $expectedAssetOrigin = "http://127.0.0.1:$WorkerPort"
  $assetUrls = @($scriptMatch.Value, $styleMatch.Value)
  $expectedAssetPaths = @(
    "/assets/shockaudit-app.js",
    "/assets/shockaudit-app.css"
  )
  for ($assetIndex = 0; $assetIndex -lt $assetUrls.Count; $assetIndex += 1) {
    $assetUrl = $assetUrls[$assetIndex]
    $assetUri = [Uri]$assetUrl
    if (
      $assetUri.GetLeftPart([UriPartial]::Authority) -cne $expectedAssetOrigin -or
      $assetUri.AbsolutePath -cne $expectedAssetPaths[$assetIndex] -or
      $assetUri.Query -cne "?v=$uiBuildLabel"
    ) {
      Stop-WithFriendlyError "A served UI asset did not match the controlled origin, path, and exact build query."
    }
    $asset = Invoke-WebRequest -UseBasicParsing -Method Get -Uri $assetUrl `
      -TimeoutSec 30
    if ([int]$asset.StatusCode -ne 200 -or [string]::IsNullOrWhiteSpace([string]$asset.Content)) {
      Stop-WithFriendlyError "The served UI asset '$assetUrl' was not readable."
    }
    if ($assetUrl -match 'shockaudit-app\.js' -and
        [string]$asset.Content -notmatch [Regex]::Escape($responseBuild)) {
      Stop-WithFriendlyError "The served UI script did not contain workflow response build '$responseBuild'."
    }
  }

} catch {
  $FailureMessage = $_.Exception.Message
} finally {
  try {
    Stop-ControlledWorker `
      -Process $ControlledWorker `
      -RunId $ControlledRunId `
      -RuntimeDirectory $ControlledRuntimeDirectory `
      -WranglerCli $wranglerCli `
      -ExpectedWorkerPort $WorkerPort `
      -ExpectedInspectorPort $InspectorPort
    Remove-ControlledRuntimeDirectory -Path $ControlledRuntimeDirectory
  } catch {
    $cleanupFailure = $_.Exception.Message
    $FailureMessage = if ([string]::IsNullOrWhiteSpace($FailureMessage)) {
      $cleanupFailure
    } else {
      "$FailureMessage Cleanup also failed: $cleanupFailure"
    }
  }
  if ($ProcessEnvironmentIsolated) {
    foreach ($name in $CredentialEnvironmentNames) {
      [Environment]::SetEnvironmentVariable(
        $name,
        $SavedProcessEnvironment[$name],
        "Process"
      )
    }
  }
  Pop-Location
}

if (-not [string]::IsNullOrWhiteSpace($FailureMessage)) {
  Write-Host ""
  Write-Host "INTEGRATED REPAIR CHECK STOPPED" -ForegroundColor Red
  Write-Host $FailureMessage -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "INTEGRATED REPAIR LOCAL CHECK COMPLETE" -ForegroundColor Green
Write-Host "Commit: $head"
Write-Host "Tree: $tree"
Write-Host "Served UI: $expectedUiResourceUri"
Write-Host "Served response build: $responseBuild"
Write-Host "AUTOMATED_TESTED: PASS"
Write-Host "LOCAL_BACKEND_AND_UI_READBACK: PASS"
Write-Host "LOCAL_PERSISTENCE_TESTED: NOT_RUN (the smoke used isolated disposable state)"
Write-Host "BROWSER_TESTED: NOT_RUN (this helper only inventories browser tests)"
Write-Host "OWNER_HOST_TESTED: NOT_RUN"
Write-Host "LIVE_QUALITY_TESTED: NOT_RUN"
Write-Host "No source search, provider request, tunnel, deployment, or production mutation was made."
Write-Host "The controlled Worker was stopped and its temporary state removed; existing .dev.vars, .wrangler state, and saved studies were not used or changed."
Write-Host "To use the published candidate, run .\scripts\windows\Start-ShockAudit-Local-Preview.ps1 and then .\scripts\windows\Start-ShockAudit-Tunnel.ps1 in a second PowerShell window."
