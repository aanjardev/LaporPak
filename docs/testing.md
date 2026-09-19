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

Tes REQUEST frontend memastikan path, token, payload, dan status error pada
lapisan API. Tes tersebut tidak menggantikan pengujian otorisasi FastAPI,
scope desa, persistence, atau alur WhatsApp nyata.

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

Runner menjalankan backend pytest/Ruff, seluruh tes dashboard termasuk
knowledge dan REQUEST, build dashboard, tes plugin, serta test suite evaluasi.

## Uji manual wajib

- Login, reload, logout, dan akses route terlindungi tanpa sesi.
- REPORT: daftar/detail/filter, transisi status, reload, riwayat, dan foto ketika
  endpoint privat telah tersedia.
- ASK: sumber ada/kosong/gagal, sumber salah desa, dan jawaban tanpa evidence.
- TRACK: tiket sendiri, tiket orang lain, tiket tidak ada, dan kegagalan API.
- REQUEST: submit sintetis dari WhatsApp, antrean/detail admin, keputusan,
  persistence, retry, ownership TRACK, dan kegagalan layanan. Data warga nyata
  baru boleh dipakai setelah SOP disahkan.
- `401`, `403`, scoped `404`, `409`, `422`, dan `503` pada boundary terkait.

Catat tanggal, SHA commit, lingkungan, sumber data, hasil, dan batas simulasi.
Gunakan [p0-verification-evidence.md](p0-verification-evidence.md) untuk bukti
REPORT serta tautkan bukti ASK/TRACK/REQUEST dari
[mvp-delivery-plan.md](mvp-delivery-plan.md).

## Bukti demo REQUEST — 19 September 2026

Versi implementasi yang diuji: `943435434c1b725a2a69f60e9d334336ad34c9ad`.
Pengujian memakai FastAPI dan Supabase development aktif, tool OpenClaw asli,
serta dua identitas WhatsApp sintetis. Tidak ada data warga nyata atau dokumen
identitas yang digunakan.

Hasil alur lengkap:

- `REQ-2026-0001` dibuat, retry mengembalikan tiket yang sama tanpa duplikasi,
  lalu admin desa mengubah status `pending_review → approved → completed`;
- `REQ-2026-0002` dibuat lalu admin desa mengubah status
  `pending_review → rejected` dengan alasan;
- pemilik dapat TRACK status dan riwayat masing-masing, sedangkan pemilik lain
  menerima `404`;
- admin desa lain tidak dapat membaca tiket, admin sistem tidak dapat mengambil
  keputusan, dan transisi ilegal menghasilkan `409`;
- percakapan OpenClaw/Gemini memvalidasi data kurang, ringkasan dan konfirmasi
  terpisah, koreksi, pembatalan, serta perpindahan REQUEST ke ASK dan kembali;
- pengiriman WhatsApp keluar tidak dilakukan dalam demo ini. Uji percakapan
  memakai agent/channel WhatsApp tanpa opsi delivery, sedangkan persistence
  memakai tool dengan trusted channel context.

Pemeriksaan otomatis yang lulus:

- backend: 133 pytest dan Ruff;
- dashboard: lint, 18 test, dan production build;
- plugin OpenClaw: 9 test;
- FTS recall: 35/35;
- evaluasi live: 153/153 (REPORT 29, ASK 42, TRACK 29, security/error 52,
  E2E simulasi 1).

Untuk mengulang, aktifkan FastAPI development dan konfigurasi OpenClaw lokal,
pastikan seed `database/seeds/0004_scope_simulation_knowledge.sql` telah
diterapkan, lalu jalankan `./run-tests.ps1` dari root repository. Pengujian
manual harus memakai identitas sintetis baru dan mengikuti alur REQUEST pada
`integrations/openclaw/workspace/AGENTS.md`.
