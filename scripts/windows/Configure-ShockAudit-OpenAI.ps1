[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$varsPath = Join-Path $repoRoot ".dev.vars"
$temporaryVarsPath = Join-Path $repoRoot ".dev.vars.tmp.$PID"
$rollbackPath = Join-Path $repoRoot ".dev.vars.rollback"
$wranglerConfigPath = Join-Path $repoRoot "wrangler.jsonc"
$obsoleteNames = @(
  "GROQ_API_KEY",
  "SHOCKAUDIT_SCREEN5_PROVIDER",
  "SHOCKAUDIT_OPENAI_MODEL",
  "SHOCKAUDIT_OPENAI_REASONING_EFFORT"
)

function Get-DevVarAssignment {
  param(
    [Parameter(Mandatory = $true)][string]$Line,
    [Parameter(Mandatory = $true)][string]$Name
  )

  $match = [Regex]::Match(
    $Line,
    "^\s*$([Regex]::Escape($Name))\s*=\s*(.*?)\s*$"
  )
  if (-not $match.Success) {
    return $null
  }
  $raw = [string]$match.Groups[1].Value
  if ($raw -match '^"([^"\r\n]*)"\s*(?:#.*)?$') {
    return [string]$Matches[1]
  }
  if ($raw -match "^'([^'\r\n]*)'\s*(?:#.*)?$") {
    return [string]$Matches[1]
  }
  return [string]([Regex]::Replace($raw, '\s+#.*$', '')).Trim()
}

function Get-UniqueDevVarValue {
  param(
    [Collections.Generic.List[string]]$Source,
    [Parameter(Mandatory = $true)][string]$Name
  )

  $values = [Collections.Generic.List[string]]::new()
  foreach ($line in $Source) {
    $value = Get-DevVarAssignment -Line ([string]$line) -Name $Name
    if ($null -ne $value -and -not [string]::IsNullOrWhiteSpace($value)) {
      if (-not $values.Contains($value)) {
        [void]$values.Add($value)
      }
    }
  }
  if ($values.Count -gt 1) {
    throw "$Name has conflicting duplicate values. Resolve that local file entry and rerun; no value was printed."
  }
  if ($values.Count -eq 1) {
    return [string]$values[0]
  }
  return ""
}

function Set-DevVar {
  param(
    [Collections.Generic.List[string]]$Target,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value
  )

  $replacement = "$Name=$Value"
  $firstIndex = -1
  for ($index = $Target.Count - 1; $index -ge 0; $index -= 1) {
    if ($Target[$index] -match "^\s*$([Regex]::Escape($Name))\s*=") {
      if ($firstIndex -eq -1) {
        $firstIndex = $index
      } else {
        $Target.RemoveAt($index)
        $firstIndex -= 1
      }
    }
  }
  if ($firstIndex -ge 0) {
    $Target[$firstIndex] = $replacement
  } else {
    [void]$Target.Add($replacement)
  }
}

function Remove-DevVar {
  param(
    [Collections.Generic.List[string]]$Target,
    [Parameter(Mandatory = $true)][string]$Name
  )

  for ($index = $Target.Count - 1; $index -ge 0; $index -= 1) {
    if ($Target[$index] -match "^\s*$([Regex]::Escape($Name))\s*=") {
      $Target.RemoveAt($index)
    }
  }
}

function Read-DevVarLines {
  param([Parameter(Mandatory = $true)][string]$Path)

  $result = [Collections.Generic.List[string]]::new()
  if (Test-Path -LiteralPath $Path) {
    foreach ($line in @(Get-Content -LiteralPath $Path)) {
      [void]$result.Add([string]$line)
    }
  }
  return ,$result
}

function Set-PrivateAcl {
  param([Parameter(Mandatory = $true)][string]$Path)

  if ($env:OS -eq "Windows_NT" -and
      (Get-Command icacls.exe -ErrorAction SilentlyContinue)) {
    & icacls.exe $Path /inheritance:r /grant:r "$($env:USERNAME):(R,W)" *> $null
    if ($LASTEXITCODE -ne 0) {
      throw "The local settings file was written, but its Windows ACL could not be restricted."
    }
  }
}

function Restore-Original {
  param([bool]$OriginalExisted)

  if ($OriginalExisted -and (Test-Path -LiteralPath $rollbackPath)) {
    Copy-Item -LiteralPath $rollbackPath -Destination $varsPath -Force
  } elseif (-not $OriginalExisted) {
    Remove-Item -LiteralPath $varsPath -Force -ErrorAction SilentlyContinue
  }
}

$originalExisted = $false
$writeStarted = $false
$plainKey = ""
$savedKey = ""
$obsoleteValue = ""
$secureKey = $null
$bstr = [IntPtr]::Zero

Push-Location $repoRoot
try {
  if (-not (Test-Path -LiteralPath $wranglerConfigPath)) {
    throw "The repository-root Wrangler configuration is missing. No local settings were changed."
  }
  $package = Get-Content -Raw -LiteralPath (Join-Path $repoRoot "package.json") | ConvertFrom-Json
  $devCommand = [string]$package.scripts.dev
  if ($devCommand -match '(?i)(?:^|\s)--(?:config|env)(?:\s|=)') {
    throw "The local development command selects a different Wrangler config or environment. No local settings were changed."
  }

  if (Get-Command git -ErrorAction SilentlyContinue) {
    & git check-ignore -q -- .dev.vars
    if ($LASTEXITCODE -ne 0) {
      throw ".dev.vars is not ignored by this checkout. Refusing to write a key."
    }
    & git check-ignore -q -- .dev.vars.rollback
    if ($LASTEXITCODE -ne 0) {
      throw ".dev.vars.rollback is not ignored by this checkout. Refusing to write a key."
    }
    $trackedDevVars = @(& git ls-files -- .dev.vars .dev.vars.rollback)
    if ($LASTEXITCODE -ne 0 -or $trackedDevVars.Count -gt 0) {
      throw ".dev.vars tracking safety could not be verified. No local settings were changed."
    }
  } else {
    $ignorePath = Join-Path $repoRoot ".gitignore"
    if (-not (Test-Path -LiteralPath $ignorePath) -or
        -not (Select-String -LiteralPath $ignorePath -SimpleMatch ".dev.vars" -Quiet)) {
      throw ".dev.vars ignore protection could not be verified."
    }
  }

  $lines = Read-DevVarLines -Path $varsPath
  $plainKey = Get-UniqueDevVarValue -Source $lines -Name "OPENAI_API_KEY"
  if ([string]::IsNullOrWhiteSpace($plainKey)) {
    $secureKey = Read-Host "OpenAI API key (input hidden; never printed)" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  }
  if ($plainKey -notmatch '^[^\s=]{16,4096}$') {
    throw "OPENAI_API_KEY is empty or has an invalid format. No local settings were changed."
  }

  foreach ($name in $obsoleteNames) {
    Remove-DevVar -Target $lines -Name $name
  }
  Set-DevVar -Target $lines -Name "OPENAI_API_KEY" -Value $plainKey
  Set-DevVar -Target $lines -Name "SHOCKAUDIT_SCREEN5_OPENAI_MODE" -Value "local-preview"

  $utf8WithoutBom = [Text.UTF8Encoding]::new($false)
  [IO.File]::WriteAllText(
    $temporaryVarsPath,
    (($lines -join [Environment]::NewLine) + [Environment]::NewLine),
    $utf8WithoutBom
  )

  $originalExisted = Test-Path -LiteralPath $varsPath
  if ($originalExisted) {
    Copy-Item -LiteralPath $varsPath -Destination $rollbackPath -Force
    Set-PrivateAcl -Path $rollbackPath
  } else {
    Remove-Item -LiteralPath $rollbackPath -Force -ErrorAction SilentlyContinue
  }
  $writeStarted = $true
  Move-Item -LiteralPath $temporaryVarsPath -Destination $varsPath -Force
  Set-PrivateAcl -Path $varsPath

  $saved = Read-DevVarLines -Path $varsPath
  $savedKey = Get-UniqueDevVarValue -Source $saved -Name "OPENAI_API_KEY"
  $savedMode = Get-UniqueDevVarValue -Source $saved -Name "SHOCKAUDIT_SCREEN5_OPENAI_MODE"
  if ($savedKey -cne $plainKey -or $savedMode -cne "local-preview") {
    throw "The local settings read-back did not match the required OpenAI configuration."
  }
  foreach ($name in $obsoleteNames) {
    $obsoleteValue = Get-UniqueDevVarValue -Source $saved -Name $name
    if (-not [string]::IsNullOrEmpty($obsoleteValue)) {
      throw "The obsolete $name entry remained after configuration."
    }
  }

  Write-Host "OpenAI Screen 5 local-preview configuration saved and verified. No network request or inference was made."
  Write-Host "Provider=openai; model=gpt-6-luna; reasoning=medium; processing=Standard; store=false."
  Write-Host "The server key is present but was not printed or authenticated by this helper."
} catch {
  if ($writeStarted) {
    Restore-Original -OriginalExisted $originalExisted
  }
  throw $_.Exception.Message
} finally {
  Remove-Item -LiteralPath $temporaryVarsPath -Force -ErrorAction SilentlyContinue
  if ($bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
  $plainKey = $null
  $savedKey = $null
  $secureKey = $null
  Pop-Location
}
