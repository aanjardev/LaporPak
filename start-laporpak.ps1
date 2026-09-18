[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$api = Join-Path $PSScriptRoot "services\api"

openclaw gateway health *> $null
if ($LASTEXITCODE -ne 0) {
    openclaw gateway start
    if ($LASTEXITCODE -ne 0) { throw "OpenClaw gateway gagal dijalankan." }
}

Push-Location $api
try {
    if (Get-Command uv -ErrorAction SilentlyContinue) {
        uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
    }
    elseif (Test-Path ".venv\Scripts\python.exe") {
        .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
    }
    else {
        throw "Install uv or run 'uv sync' in services/api first."
    }
}
finally { Pop-Location }
