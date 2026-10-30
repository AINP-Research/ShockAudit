[CmdletBinding()]
param(
  [switch]$InstallChromium,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$PreviewBranch = "codex/local-chatgpt-preview"
$LocalTestDirectory = Join-Path $RepositoryRoot ".wrangler\local-screens34-test"
$BrowserDirectory = Join-Path $LocalTestDirectory "playwright-browsers"
$ReportPath = Join-Path $LocalTestDirectory "playwright-results.json"

function Stop-WithFriendlyError {
  param([Parameter(Mandatory = $true)][string]$Message)

  Write-Host ""
  Write-Host "SCREENS 3-5 TEST STOPPED" -ForegroundColor Red
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

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$Description,
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [string]$FailureHelp = ""
  )

  Write-Host ""
  Write-Host $Description -ForegroundColor Cyan
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    $suffix = if ([string]::IsNullOrWhiteSpace($FailureHelp)) {
      "Read the error above and retry."
    } else {
      $FailureHelp
    }
    Stop-WithFriendlyError "$Description failed. $suffix"
  }
}

Push-Location $RepositoryRoot
try {
  Write-Host "ShockAudit local-only Screens 3-5 verification" -ForegroundColor Cyan
  Write-Host "This uses an in-memory deterministic source fixture. It does not deploy, use production storage, or prove signed-in ChatGPT behavior."

  $git = Get-RequiredCommand -Name "git.exe" -InstallHelp "Install Git for Windows and reopen PowerShell."
  $node = Get-RequiredCommand -Name "node.exe" -InstallHelp "Install Node.js 22 LTS or newer and reopen PowerShell."
  $npm = Get-RequiredCommand -Name "npm.cmd" -InstallHelp "npm is included with Node.js."
  $npx = Get-RequiredCommand -Name "npx.cmd" -InstallHelp "npx is included with Node.js."

  $branch = ((& $git.Source branch --show-current 2>$null) | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $branch -ne $PreviewBranch) {
    Stop-WithFriendlyError "Open the ShockAudit checkout on branch '$PreviewBranch' before testing."
  }
  if (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot "node_modules"))) {
    Stop-WithFriendlyError "Dependencies are missing. Run .\scripts\windows\Setup-ShockAudit-Local-Preview.ps1 first."
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

  New-Item -ItemType Directory -Force -Path $BrowserDirectory | Out-Null
  $env:PLAYWRIGHT_BROWSERS_PATH = $BrowserDirectory
  $env:SHOCKAUDIT_BROWSER_BASE_URL = "http://127.0.0.1:8793"
  $env:SHOCKAUDIT_BROWSER_NODE_FIXTURE = "1"
  $env:SHOCKAUDIT_BROWSER_GATE_KIND = "local-screens34-fixture"
  $env:SHOCKAUDIT_PLAYWRIGHT_REPORT = $ReportPath

  if ($InstallChromium) {
    Invoke-Checked -Description "Installing the pinned Chromium build into isolated local storage..." -Command $npx.Source -Arguments @("--no-install", "playwright", "install", "chromium") -FailureHelp "The official browser download did not complete. Check network access and rerun this command; do not change project versions or disable TLS."
  }

  if (-not $SkipBuild) {
    Invoke-Checked -Description "Building the checked-out candidate..." -Command $npm.Source -Arguments @("run", "build")
  }
  Invoke-Checked -Description "Running focused response, state, execution, and render checks..." -Command $npx.Source -Arguments @(
    "--no-install", "vitest", "run",
    "tests/core/six-screen-study-design-advice.test.ts",
    "tests/worker/screen04-study-first-investigation.test.ts",
    "tests/worker/screen05-openalex-literature.test.ts",
    "tests/worker/screen05-crossref-literature.test.ts",
    "tests/worker/screen05-study-first-mechanism.test.ts",
    "tests/worker/six-screen-screen4-interpretation-tools.test.ts",
    "tests/worker/six-screen-study-first-mechanism-runtime.test.ts",
    "tests/worker/study-first-host-intelligence.test.ts",
    "tests/worker/six-screen-tools.test.ts",
    "tests/ui/six-screen-app.test.tsx"
  )
  Invoke-Checked -Description "Running the real Chromium fixture journey and capturing Screens 3-5..." -Command $npx.Source -Arguments @(
    "--no-install", "playwright", "test",
    "tests/browser/six-screen-screen01-screen02.spec.ts",
    "--project=chromium",
    "--grep", "CCPA supplied-source journey"
  ) -FailureHelp "If the error says the Chromium executable is missing, rerun with -InstallChromium. A listed test is not a completed browser run."

  Write-Host ""
  Write-Host "SCREENS 3-5 TEST COMPLETE" -ForegroundColor Green
  Write-Host "Fixture screenshots are under .\artifacts\release-gates\screenshots."
  Write-Host "This confirms the deterministic local browser journey only; complete the signed-in Local Preview review separately."
} catch {
  Stop-WithFriendlyError $_.Exception.Message
} finally {
  Pop-Location
}
