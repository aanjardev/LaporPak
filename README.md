# LaporPak

LaporPak adalah platform layanan publik desa berbasis WhatsApp. Target MVP mencakup ASK (tanya layanan), REPORT (laporan warga), REQUEST (pengajuan layanan), TRACK (pantau status), dan dukungan multi-desa. Fokus pengembangan pertama adalah REPORT. Dashboard memakai Supabase Auth invite-only dan kini mencakup pengelolaan REPORT, sumber ASK, serta workflow admin REQUEST.

## Dokumen acuan

- [AGENTS.md](AGENTS.md) berisi aturan kerja Codex dan peta dokumen.
- [Project context](docs/project-context.md) menjelaskan scope dan urutan MVP.
- [Architecture](docs/architecture.md) menjelaskan batas komponen dan alur OpenClaw/Gemini/FastAPI.
- [API contract](docs/api-contract.md) dan [workflows](docs/workflows.md) menjadi acuan implementasi lintas role.
- [Development rules](docs/development-rules.md) memuat setup, Git, dan pemeriksaan sebelum PR.
- [PRD V3](docs/prd/PRD_V3_AI_Village_Service_Agent.md) adalah acuan kebutuhan produk lengkap; P0 REPORT adalah tahap awal menuju MVP tersebut.
- [MVP delivery plan](docs/mvp-delivery-plan.md) mencatat progress, dependensi, pemilik tugas, dan gerbang integrasi berikutnya.

Git Bash dan PowerShell sama-sama dapat dipakai. Contoh perintah di bawah memakai PowerShell; padanan Git Bash ada di development rules.

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

- Dashboard menampilkan daftar/detail REPORT dengan pencarian, filter, pagination, dan verifikasi/penolakan melalui data mock atau FastAPI.
- FastAPI menyediakan POST, list, detail, dan perubahan status REPORT dengan transaksi serta riwayat.
- Migration dan seed REPORT sudah diterapkan serta diverifikasi pada Supabase development.
- Login admin memakai Supabase Auth invite-only; FastAPI memvalidasi access token untuk GET/PATCH.
- Plugin OpenClaw dan kontrak tool REPORT tersedia; integrasi WhatsApp dasar sudah dapat menyimpan laporan dan masih dikembangkan lebih lanjut.
- FastAPI dan plugin OpenClaw menyediakan baseline ASK serta TRACK; aktivasi nyata tetap memerlukan sumber resmi dan uji kepemilikan kanal.
- FastAPI, dashboard, dan tool OpenClaw mempunyai baseline REQUEST `residency_letter`. SOP, riwayat detail, serta uji E2E bersama masih terbuka; gunakan data sintetis sampai keputusan tersebut disahkan.
- Struktur cakupan admin, channel, knowledge, REPORT, dan REQUEST per unit sudah tersedia; isolasi dua desa belum dinyatakan lulus.
