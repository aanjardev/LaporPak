# openclaw-helper.ps1
# Jalankan sekali per sesi PowerShell, atau tambahkan ke $PROFILE untuk selalu tersedia.
#
# Usage:
#   . D:\Dev\LaporPak\integrations\openclaw\openclaw-helper.ps1
#   oc gateway health
#   oc channels status --probe
#   oc channels login --channel whatsapp

$OC_NODE  = 'C:\Users\user\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\OpenClaw\deps\portable-node\node.exe'
$OC_ENTRY = 'C:\Users\user\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\OpenClaw\deps\portable-node\node_modules\openclaw\dist\index.js'

if (-not (Test-Path -LiteralPath $OC_NODE)) {
    Write-Warning "OpenClaw node.exe tidak ditemukan di: $OC_NODE"
    Write-Warning "Pastikan OpenClaw sudah terpasang melalui Codex."
} elseif (-not (Test-Path -LiteralPath $OC_ENTRY)) {
    Write-Warning "openclaw dist/index.js tidak ditemukan di: $OC_ENTRY"
} else {
    function oc {
        & $OC_NODE $OC_ENTRY @args
    }
    Write-Host "✓ OpenClaw helper aktif — ketik 'oc --version' untuk verifikasi" -ForegroundColor Green
}
