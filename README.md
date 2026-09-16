# LaporPak

LaporPak adalah platform layanan publik desa berbasis WhatsApp. Alur yang dituju adalah ASK (tanya layanan), REPORT (laporan warga), REQUEST (pengajuan layanan), dan TRACK (pantau status). Saat ini repository masih berisi fondasi dashboard, API, dan skema database; alur produk tersebut belum terimplementasi.

## Struktur proyek

```text
apps/dashboard/       Next.js, TypeScript, Tailwind CSS, shadcn/ui
services/api/         FastAPI, Pydantic, SQLAlchemy
database/migrations/  Skema PostgreSQL untuk Supabase
database/seeds/       Kategori laporan awal
data/knowledge-base/  Tempat dokumen layanan desa yang disetujui
docs/                 Dokumentasi proyek
```

## Persiapan lokal

- Git, Node.js, npm, dan uv.
- Python 3.14 untuk API, sesuai `services/api/.python-version` dan `pyproject.toml`.
- Proyek Supabase dan kredensial database diperlukan saat mulai menguji integrasi data. Jangan commit nilai rahasia dari file `.env`.

### Dashboard

```powershell
cd apps/dashboard
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Dashboard tersedia di `http://localhost:3000`. Lihat [petunjuk dashboard](apps/dashboard/README.md) untuk pemeriksaan lokal.

### API

Di terminal lain:

```powershell
cd services/api
Copy-Item .env.example .env
uv sync
uv run uvicorn app.main:app --reload
```

API tersedia di `http://localhost:8000`; endpoint awalnya adalah `/health` dan dokumentasi otomatis tersedia di `/docs`. Lihat [petunjuk API](services/api/README.md) untuk pemeriksaan lokal dan database.

## Status pengembangan

- Dashboard masih menampilkan halaman bawaan Next.js.
- API baru menyediakan endpoint dasar dan health check.
- Migrasi SQL dan seed kategori sudah ditulis, tetapi penerapannya ke Supabase harus dilakukan dan diverifikasi terpisah.
- Integrasi WhatsApp/OpenClaw, autentikasi admin, dan alur laporan belum tersedia.
