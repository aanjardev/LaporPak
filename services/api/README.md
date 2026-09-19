# API LaporPak

API menggunakan FastAPI, Pydantic, SQLAlchemy, dan PostgreSQL Supabase. Endpoint
`POST /api/v1/reports` menerima create REPORT terautentikasi dari OpenClaw,
menegakkan idempotency, lalu menyimpan laporan dan status history dalam satu
transaksi.

Endpoint GET/detail/PATCH admin menerima access token Supabase Auth pada bearer
header. FastAPI memvalidasi token melalui proyek Supabase yang dikonfigurasi,
memetakan identitas ke `admin_accounts`, lalu memakai
`admin_unit_memberships` untuk cakupan `village_admin`.

Baseline API saat ini juga mencakup ASK, TRACK, pengelolaan knowledge, dan
REQUEST `residency_letter`. ASK dan TRACK adalah endpoint warga yang hanya
dipanggil OpenClaw tepercaya. REQUEST sudah mempunyai create/list/detail/status
sebagai baseline teknis, tetapi belum boleh dianggap layanan resmi sebelum SOP,
field minimum, kewenangan petugas, dan kontrak lintas role disahkan.

Endpoint utama:

```text
POST              /api/v1/reports
GET               /api/v1/reports
GET               /api/v1/reports/{id}
PATCH             /api/v1/reports/{id}/status
POST              /api/v1/ask
POST              /api/v1/track
GET/POST/PATCH/DELETE /api/v1/knowledge/...
POST              /api/v1/service-requests
GET               /api/v1/service-requests
GET               /api/v1/service-requests/{id}
PATCH             /api/v1/service-requests/{id}/status
```

Kontrak lengkap, header wajib, enum, dan error berada di
[`docs/api-contract.md`](../../docs/api-contract.md).

## Menjalankan lokal

Gunakan Python 3.14 sesuai `.python-version` dan `pyproject.toml`.

```powershell
Copy-Item .env.example .env
uv sync
uv run uvicorn app.main:app --reload
```

Buka `http://localhost:8000/health` untuk memeriksa API atau `http://localhost:8000/docs` untuk dokumentasi endpoint. Server dasar tidak memerlukan koneksi database. Isi `DATABASE_URL` di `.env` sebelum memeriksa koneksi database atau mengembangkan endpoint yang memakainya. Jangan commit `.env`.

## Pemeriksaan

```powershell
uv run pytest -q
uv run ruff check .
uv run python -m app.db.check
```

Perintah terakhir memerlukan `DATABASE_URL` aktif dan hanya memeriksa koneksi,
bukan menjalankan migrasi. Skrip schema, guard pembuatan laporan, hardening,
dan seed tersedia di `../../database/` dan harus diterapkan berurutan.
