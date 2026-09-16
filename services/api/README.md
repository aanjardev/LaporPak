# API LaporPak

API menggunakan FastAPI, Pydantic, SQLAlchemy, dan PostgreSQL Supabase. Implementasi saat ini hanya menyediakan `/` dan `/health`; endpoint laporan dan integrasi WhatsApp belum dibuat.

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

Perintah terakhir memerlukan `DATABASE_URL` aktif dan hanya memeriksa koneksi, bukan menjalankan migrasi. Skrip skema dan seed ada di `../../database/`; penerapannya ke Supabase belum diotomatisasi di repository ini.
