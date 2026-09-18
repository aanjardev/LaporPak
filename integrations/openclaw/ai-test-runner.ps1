[CmdletBinding()]
param(
    [switch]$All,
    [switch]$FTS,
    [switch]$Evals,
    [switch]$Gaps,
    [switch]$Suite,
    [switch]$Report
)

$ErrorActionPreference = "Stop"
$testArgs = @()

if ($FTS) { $testArgs += "--fts" }
if ($Evals) { $testArgs += "--evals" }
if ($Gaps) { $testArgs += "--gaps" }
if ($All -or $Suite -or $testArgs.Count -eq 0) { $testArgs += "--all" }
if ($Report) { $testArgs += "--report" }
if ($PSBoundParameters.ContainsKey("Verbose")) { $testArgs += "--verbose" }

Push-Location (Join-Path $PSScriptRoot "evals")
try {
    & node "test-suite.js" @testArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    Pop-Location
}
