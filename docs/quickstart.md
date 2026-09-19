# LaporPak Quick Start

Panduan ini menjalankan dashboard, FastAPI, dan pemeriksaan lokal tanpa
menyimpan secret di Git. Baca `AGENTS.md` dan dokumen source of truth sebelum
mengubah kontrak.

## Prasyarat

- Node.js LTS; plugin OpenClaw saat ini mensyaratkan Node.js `>=24.15.0`.
- Python `>=3.14` dan `uv`.
- Proyek Supabase development.
- OpenClaw dan WhatsApp hanya diperlukan untuk uji kanal nyata.

## 1. Konfigurasi environment

Backend:

```powershell
Copy-Item services/api/.env.example services/api/.env
```

Isi sekurangnya `DATABASE_URL`, konfigurasi Supabase, dan
`OPENCLAW_API_KEY`. Untuk operasi warga melalui OpenClaw, siapkan pula channel
aktif yang cocok dengan `X-Channel-Account-ID`. Jangan commit `.env`.

Frontend:

```powershell
Copy-Item apps/dashboard/.env.example apps/dashboard/.env.local
```

Isi `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, dan anon key publik.
Jangan memasukkan service role key ke frontend.

## 2. Database

Terapkan semua file `database/migrations/` menurut nomor file, lalu jalankan
seed menurut urutan:

```powershell
psql $env:DATABASE_URL -f database/seeds/0001_report_categories.sql
psql $env:DATABASE_URL -f database/seeds/0002_demo_administrative_units.sql
psql $env:DATABASE_URL -f database/seeds/0003_production_access.sql
```

Migration yang sudah diterapkan tidak boleh diedit atau dilewati.
`0003_production_access.sql` berisi UUID akun demo dan channel sementara;
tinjau serta ganti nilainya untuk project Supabase lain sebelum menjalankannya.

## 3. Jalankan aplikasi

Terminal API:

```powershell
cd services/api
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Terminal dashboard:

```powershell
cd apps/dashboard
npm ci
npm run dev
```

Alamat lokal:

```text
Dashboard  http://localhost:3000
API        http://localhost:8000
Health     http://localhost:8000/health
OpenAPI    http://localhost:8000/docs
```

`start-laporpak.ps1` dapat menjalankan OpenClaw Gateway dan FastAPI, tetapi
dashboard tetap dijalankan pada terminal terpisah.

## 4. Akun admin

Gunakan akun Supabase Auth invite-only. UUID Auth harus memiliki baris aktif
di `admin_accounts`. Untuk `village_admin`, tambahkan unit yang diizinkan ke
`admin_unit_memberships`. Jangan mengaktifkan pendaftaran admin publik.

Setelah login dashboard, uji endpoint admin melalui aplikasi atau:

```bash
curl http://localhost:8000/api/v1/reports \
  -H "Authorization: Bearer <supabase-access-token>"
```

Jangan menaruh token pada dokumentasi, Git, atau chat.

## 5. Endpoint warga

ASK dan TRACK hanya boleh dipanggil oleh OpenClaw tepercaya. Keduanya memerlukan
`X-OpenClaw-API-Key` dan `X-Channel-Account-ID`; TRACK juga memakai nomor
pengirim dari metadata WhatsApp, bukan teks model.

```bash
curl -X POST http://localhost:8000/api/v1/ask \
  -H "X-OpenClaw-API-Key: <key>" \
  -H "X-Channel-Account-ID: <channel-account-id>" \
  -H "Content-Type: application/json" \
  -d '{"question":"Kapan kantor buka?"}'
```

Gunakan data sintetis. ASK baru dianggap siap jika sumbernya telah disetujui.

## 6. Pratinjau REQUEST

Set `REQUESTS_PREVIEW=mock` hanya di `apps/dashboard/.env.local` untuk membuka
`/reports/requests`. Pratinjau memakai data sintetis, tidak memanggil FastAPI,
dan otomatis tertutup pada production build. Integrasi REQUEST nyata menunggu
SOP dan kontrak admin disahkan.

## 7. Pemeriksaan

Lihat [testing.md](testing.md) untuk semua perintah. Minimum sebelum PR:

```powershell
cd services/api
uv run pytest
uv run ruff check .

cd ../../apps/dashboard
npm run lint
npx tsc --noEmit
npm run build
```

## Troubleshooting

- `401 UNAUTHORIZED`: periksa kredensial pemanggil dan sesi/token.
- `403 FORBIDDEN`: akun terautentikasi tetapi tidak memiliki peran yang sesuai.
- `404`: detail dapat tidak ada atau berada di luar cakupan desa.
- `503 DATABASE_UNAVAILABLE`: periksa `DATABASE_URL`, migration, dan koneksi
  Supabase; jangan mengubah kegagalan menjadi respons sukses.
