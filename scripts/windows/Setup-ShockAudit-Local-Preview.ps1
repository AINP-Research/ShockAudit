[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$PreviewBranch = "codex/local-chatgpt-preview"
$RepositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Stop-WithFriendlyError {
  param([Parameter(Mandatory = $true)][string]$Message)

  Write-Host ""
  Write-Host "SETUP STOPPED" -ForegroundColor Red
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
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  Write-Host ""
  Write-Host $Description -ForegroundColor Cyan
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    Stop-WithFriendlyError "$Description failed. Read the error above, correct it, and run this setup script again."
  }
}

function Assert-PreviewBranch {
  param([Parameter(Mandatory = $true)][string]$GitCommand)

  $branch = ((& $GitCommand rev-parse --abbrev-ref HEAD 2>$null) | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
    Stop-WithFriendlyError "This folder is not a usable Git checkout of ShockAudit. Open PowerShell in the ShockAudit repository and try again."
  }
  if ($branch -ne $PreviewBranch) {
    Stop-WithFriendlyError "You are on branch '$branch'. Switch safely with: git fetch origin; git switch $PreviewBranch; git pull --ff-only"
  }
}

function Assert-SafeDevCommand {
  $packagePath = Join-Path $RepositoryRoot "package.json"
  $package = Get-Content -Raw -LiteralPath $packagePath | ConvertFrom-Json
  $devCommand = [string]$package.scripts.dev
  if ($devCommand -notmatch "wrangler\s+dev") {
    Stop-WithFriendlyError "package.json no longer uses the expected local Wrangler development command. Ask the repository maintainer to review it."
  }
  if ($devCommand -match "(?i)(wrangler\s+deploy|npm(?:\.cmd)?\s+run\s+deploy|\s--remote(?:\s|$)|\bpublish\b)") {
    Stop-WithFriendlyError "The npm development command contains a production-capable action. Nothing was started. Ask the repository maintainer to review it."
  }
}

function Assert-SecretIgnores {
  param([Parameter(Mandatory = $true)][string]$GitCommand)

  $secretPaths = @(
    ".dev.vars",
    ".dev.vars.local",
    ".env",
    ".env.local",
    "local-secrets/example.txt",
    "credentials/example.json",
    "example.local.secret",
    "example.secret",
    "example.key",
    "example.pem",
    "example.p12",
    "example.pfx"
  )

  foreach ($path in $secretPaths) {
    & $GitCommand check-ignore --no-index --quiet -- $path
    if ($LASTEXITCODE -ne 0) {
      Stop-WithFriendlyError "Git is not ignoring the local secret path '$path'. Nothing was changed; ask the repository maintainer to repair .gitignore."
    }
  }

  & $GitCommand check-ignore --no-index --quiet -- ".dev.vars.example"
  if ($LASTEXITCODE -eq 0) {
    Stop-WithFriendlyError ".dev.vars.example is unexpectedly ignored. The safe, empty example must remain trackable."
  }
}

Push-Location $RepositoryRoot
try {
  Write-Host "ShockAudit local preview setup" -ForegroundColor Cyan
  Write-Host "This installs local dependencies and builds the project. It does not deploy anything."

  $git = Get-RequiredCommand -Name "git.exe" -InstallHelp "Install Git for Windows, close PowerShell, and open it again."
  $node = Get-RequiredCommand -Name "node.exe" -InstallHelp "Install Node.js 22 LTS or newer, close PowerShell, and open it again."
  $npm = Get-RequiredCommand -Name "npm.cmd" -InstallHelp "npm is included with Node.js. Reinstall Node.js 22 LTS or newer."

  $nodeVersionText = ((& $node.Source --version) | Out-String).Trim().TrimStart("v")
  try {
    $nodeVersion = [version]$nodeVersionText
  } catch {
    Stop-WithFriendlyError "Node.js reported version '$nodeVersionText', which this helper could not understand. Install Node.js 22 LTS or newer."
  }
  if ($nodeVersion.Major -lt 22) {
    Stop-WithFriendlyError "Node.js $nodeVersionText is too old. Install Node.js 22 LTS or newer, then reopen PowerShell."
  }

  Assert-PreviewBranch -GitCommand $git.Source
  Assert-SafeDevCommand
  Assert-SecretIgnores -GitCommand $git.Source

  Invoke-Checked -Description "Installing the exact repository dependencies..." -Command $npm.Source -Arguments @("ci", "--no-audit", "--no-fund")
  # Match the launcher's self-contained build, including local artifact checks and TypeScript.
  Invoke-Checked -Description "Building the ShockAudit local preview..." -Command $npm.Source -Arguments @("run", "build:local-preview")

  Write-Host ""
  Write-Host "SETUP COMPLETE" -ForegroundColor Green
  Write-Host "Next: run .\scripts\windows\Start-ShockAudit-Local-Preview.ps1 in this folder."
  Write-Host "No deployment or production resource was touched."
} catch {
  Stop-WithFriendlyError $_.Exception.Message
} finally {
  Pop-Location
}
