# LaporPak Testing Guide

Gunakan data, akun, nomor WhatsApp, dan channel khusus pengujian. Jangan menulis
secret, token, atau data warga nyata ke fixture dan laporan hasil.

## Persiapan

```powershell
cd services/api
uv sync

cd ../../apps/dashboard
npm ci
```

Node.js LTS dan Python `>=3.14` wajib tersedia. Dependency Python dikelola
melalui `uv`; jangan memakai `pip install` manual untuk project ini.

## Pemeriksaan backend

```powershell
cd services/api
uv run pytest
uv run ruff check .
```

Untuk pengujian integrasi nyata, jalankan FastAPI dan gunakan environment
development yang migrasinya sudah lengkap. Bedakan hasil unit/simulasi dari
hasil API dan database nyata.

## Pemeriksaan frontend

```powershell
cd apps/dashboard
npm run lint
npx tsc --noEmit
npm run test:auth
npm run test:reports
npm run test:knowledge
npm run test:requests
npm run build
```

Tes REQUEST memastikan pratinjau tidak memakai jaringan atau database. Tes
simulasi tidak membuktikan otorisasi FastAPI, scope desa, atau persistence.

## OpenClaw dan evaluasi AI

```powershell
cd integrations/openclaw/plugins/laporpak-tools
npm test

cd ../../evals
node test-suite.js
node fts-recall.js
node runner.js --verbose
```

Evaluasi dataset menguji kontrak dan perilaku terstruktur. E2E WhatsApp tetap
memerlukan host OpenClaw, Gemini, channel aktif, FastAPI, dan Supabase yang sama.

## Runner repository

```powershell
.\run-tests.ps1
```

Runner saat ini menjalankan backend pytest/Ruff, lint dan tes inti dashboard,
build dashboard, tes plugin, serta test suite evaluasi. Sampai runner diperbarui
untuk tes knowledge dan REQUEST, jalankan `npm run test:knowledge` dan
`npm run test:requests` secara terpisah seperti daftar di atas.

## Uji manual wajib

- Login, reload, logout, dan akses route terlindungi tanpa sesi.
- REPORT: daftar/detail/filter, transisi status, reload, riwayat, dan foto ketika
  endpoint privat telah tersedia.
- ASK: sumber ada/kosong/gagal, sumber salah desa, dan jawaban tanpa evidence.
- TRACK: tiket sendiri, tiket orang lain, tiket tidak ada, dan kegagalan API.
- REQUEST: pratinjau responsif; integrasi nyata baru diuji setelah SOP disahkan.
- `401`, `403`, scoped `404`, `409`, `422`, dan `503` pada boundary terkait.

Catat tanggal, SHA commit, lingkungan, sumber data, hasil, dan batas simulasi.
Gunakan [p0-verification-evidence.md](p0-verification-evidence.md) untuk bukti
REPORT serta tautkan bukti ASK/TRACK/REQUEST dari
[mvp-delivery-plan.md](mvp-delivery-plan.md).
