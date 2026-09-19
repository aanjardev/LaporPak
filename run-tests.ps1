[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$api = Join-Path $root "services\api"
$dashboard = Join-Path $root "apps\dashboard"
$plugin = Join-Path $root "integrations\openclaw\plugins\laporpak-tools"
$evals = Join-Path $root "integrations\openclaw\evals"

function Invoke-Checked {
    param([scriptblock]$Command)
    & $Command
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Push-Location $api
try {
    if (Get-Command uv -ErrorAction SilentlyContinue) {
        Invoke-Checked { uv run pytest }
        Invoke-Checked { uv run ruff check . }
    }
    elseif (Test-Path ".venv\Scripts\python.exe") {
        Invoke-Checked { .venv\Scripts\python.exe -m pytest }
        Invoke-Checked { .venv\Scripts\python.exe -m ruff check . }
    }
    else {
        throw "Install uv or run 'uv sync' in services/api first."
    }
}
finally { Pop-Location }

Push-Location $dashboard
try {
        Invoke-Checked { npm run lint }
        Invoke-Checked { npm run test:auth }
        Invoke-Checked { npm run test:reports }
        Invoke-Checked { npm run test:knowledge }
        Invoke-Checked { npm run test:requests }
        Invoke-Checked { npm run build }
}
finally { Pop-Location }

Push-Location $plugin
try { Invoke-Checked { npm test } }
finally { Pop-Location }

Push-Location $evals
try { Invoke-Checked { node test-suite.js } }
finally { Pop-Location }
