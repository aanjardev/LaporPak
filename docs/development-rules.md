# LaporPak — Development Rules

> **Document status:** aturan development, collaboration, dependency, testing, dan migration.  
> **Contract version:** `0.2.0`

---

## 1. Development Environment

Canonical Day 1 environment:

```text
Windows
Git Bash atau PowerShell
VS Code
Git
GitHub
Node.js LTS
npm
Python >= 3.14
uv
```

Tidak diwajibkan:

```text
Docker
WSL
Ubuntu
local PostgreSQL
```

Semua developer harus bisa menjalankan repository tanpa setup khusus milik satu orang. Kedua terminal didukung; gunakan perintah lint/test/build yang sama, dan tampilkan variasi shell hanya untuk perintah yang sintaksnya berbeda.

---

## 2. Initial Setup

### Clone

```bash
git clone <repository-url>
cd LaporPak
```

### Frontend

```bash
cd apps/dashboard
npm ci
cp .env.example .env.local
npm run dev
```

Di PowerShell, ganti `cp .env.example .env.local` dengan `Copy-Item .env.example .env.local`.

Expected:

```text
http://localhost:3000
```

### Backend

```bash
cd services/api
uv sync
cp .env.example .env
uv run uvicorn app.main:app --reload --port 8000
```

Di PowerShell, ganti `cp .env.example .env` dengan `Copy-Item .env.example .env`.

Expected:

```text
http://localhost:8000
http://localhost:8000/health
http://localhost:8000/docs
```

---

## 3. Environment Files

### Frontend

```text
apps/dashboard/.env.example   → commit
apps/dashboard/.env.local     → local only
```

Minimum:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Jangan simpan secret pada variable `NEXT_PUBLIC_*`.

### Backend

```text
services/api/.env.example     → commit
services/api/.env             → local only
```

Backend variables dapat mencakup:

```env
APP_ENV=development
FRONTEND_URL=http://localhost:3000

DATABASE_URL=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=

OPENCLAW_URL=
OPENCLAW_API_KEY=
```

Secret tidak boleh di-commit.
Gemini dipanggil OpenClaw; konfigurasikan `GEMINI_API_KEY` hanya di environment OpenClaw/integrasi AI, bukan FastAPI.

---

## 4. Dependency Rules

### Frontend

Untuk setup bersih dari `package-lock.json` gunakan:

```bash
npm ci
```

Untuk menambah atau memperbarui dependency secara sengaja, gunakan `npm install <package>` dan review perubahan lockfile.

Jangan:

```bash
npm update
```

tanpa alasan yang disetujui.

`package-lock.json` harus di-commit.

Jangan install Next.js global.

### Backend

Gunakan:

```bash
uv add <package>
uv add --dev <package>
uv sync
```

Jangan memakai `pip install` manual untuk dependency project.

`pyproject.toml` dan `uv.lock` harus di-commit.

---

## 5. Python Version

Project minimum:

```text
Python >= 3.14
```

`.python-version` harus mengikuti requirement project.

Cek:

```bash
uv run python --version
```

---

## 6. Git Workflow

Canonical workflow:

```text
main
├── feat/<name>
├── fix/<name>
├── docs/<name>
└── refactor/<name>
```

Tidak menggunakan `develop` untuk Day 1.

### Start task

```bash
git checkout main
git pull origin main
git checkout -b feat/report-api
```

### Finish task

```bash
git status
git diff
git add .
git commit -m "feat(api): add create report endpoint"
git push -u origin feat/report-api
```

Buat Pull Request ke:

```text
main
```

Jangan push langsung ke `main`.

---

## 7. Commit Style

Recommended:

```text
feat(frontend): add reports table
feat(api): add report detail endpoint
feat(ai): add report extraction schema
fix(api): reject invalid status transition
test(api): add report creation tests
docs(contract): freeze report category codes
refactor(api): move report rules to service layer
chore(repo): update environment template
```

Commit harus kecil dan punya satu tujuan jelas.

---

## 8. Shared Contract Rule

Perubahan berikut wajib dikomunikasikan ke semua role:

- endpoint;
- request body;
- response body;
- enum;
- category code;
- status;
- DB field lintas komponen;
- AI structured output;
- error code;
- required field.

Jangan merge breaking contract change tanpa update:

```text
api-contract.md
workflows.md (jika alur berubah)
architecture.md (jika boundary berubah)
```

---

## 9. Frontend Rules

Root:

```text
apps/dashboard/
```

Frontend:

- consume API contract;
- gunakan TypeScript;
- gunakan API abstraction, jangan fetch tersebar sembarangan;
- tampilkan loading/error/empty state;
- jangan hardcode business rule;
- jangan direct database write;
- jangan simpan secret;
- mock data harus sama dengan response contract.

Sebelum PR:

```bash
npm run lint
npm run build
```

Keduanya wajib lolos.

---

## 10. Backend Rules

Root:

```text
services/api/
```

Backend:

- gunakan Pydantic untuk boundary input/output;
- pisahkan route, schema, service, db logic;
- route tidak boleh memuat seluruh business logic;
- validate state transition di backend;
- database failure tidak boleh diubah menjadi fake success;
- gunakan transaction untuk operation terkait;
- AI output tidak boleh langsung dipersist sebagai operational truth;
- ticket number hanya server-side.

Sebelum PR:

```bash
uv run pytest
uv run ruff check .
```

Keduanya wajib lolos.

Jika Ruff mengatakan fixable:

```bash
uv run ruff check . --fix
uv run ruff check .
```

---

## 11. AI Development Rules

AI module:

```text
services/api/app/services/ai/
```

Rules:

- output structured;
- gunakan schema canonical;
- confidence advisory;
- `missing_fields` advisory;
- tidak direct DB;
- tidak output operational action yang dieksekusi tanpa backend validation;
- prompt harus menjaga permission boundary;
- test minimal mencakup normal, incomplete, ambiguous, unrelated/UNKNOWN.

Dataset test AI dapat disimpan di lokasi yang disepakati dalam `data/` atau test fixtures.

---

## 12. OpenClaw Rules

OpenClaw:

- hanya tool yang disetujui;
- tidak menyimpan credential ke prompt;
- tidak mempunyai SQL/database tool langsung;
- tidak boleh memanggil status mutation atas keputusan AI sendiri;
- session/context tidak menjadi system of record.

---

## 13. Database Migration Rules

Root:

```text
database/migrations/
database/seeds/
```

Rules:

1. Migration yang sudah dijalankan tidak diubah untuk perubahan berikutnya.
2. Buat migration baru dengan nomor berurutan.
3. Migration harus dapat direview lewat Git.
4. Seed sebaiknya idempotent.
5. Database field yang dikonsumsi API harus konsisten dengan contract.
6. Jangan membuat perubahan schema hanya melalui dashboard tanpa menyimpan SQL migration.

Contoh:

```text
0001_core_schema.sql
0002_add_external_message_id.sql
0003_add_audit_logs.sql
```

---

## 14. Canonical Database Names

Gunakan:

```text
reports
report_status_history
report_attachments
```

Jangan memperkenalkan tabel:

```text
tickets
ticket_status_history
attachments
```

untuk merepresentasikan entity yang sama tanpa contract migration resmi.

`ticket_number` adalah field pada `reports`.

---

## 15. Database Verification

Setelah perubahan migration:

- jalankan SQL;
- cek schema;
- test connection backend;
- jalankan backend test.

Contoh:

```bash
cd services/api
uv run python -m app.db.check
uv run pytest
uv run ruff check .
```

---

## 16. API Versioning

Application API menggunakan:

```text
/api/v1
```

Health tetap:

```text
/health
```

Breaking API change tidak boleh dilakukan diam-diam.

---

## 17. Error Handling

Jangan:

```text
except Exception:
    return success
```

Gunakan error code contract.

Log internal boleh detail, tetapi response tidak boleh membocorkan:

- DB password;
- API key;
- stack trace production;
- token;
- connection string.

---

## 18. Idempotency

Integrasi WhatsApp/webhook harus mencegah request yang sama menghasilkan report ganda.

Sebelum real WhatsApp integration, pastikan:

```text
Idempotency-Key dari ID draf laporan yang stabil,
disimpan UNIQUE bersama report dan initial status history
```

Untuk deduplikasi event masuk, `external_message_id` dapat ditambahkan terpisah:

```text
external_message_id UNIQUE
```

Retry create dengan key dan payload sama mengembalikan report pertama; key sama dengan payload berbeda menghasilkan `409 DUPLICATE_OPERATION`. Keduanya tidak boleh menghasilkan tiket kedua.

Technical duplicate berbeda dengan semantic duplicate.

---

## 19. Security Basics

- `.env` tidak masuk Git.
- Supabase secret key backend only.
- Gemini key hanya pada konfigurasi OpenClaw/integrasi AI; tidak masuk frontend, prompt, Git, atau log.
- WhatsApp access token backend/integration only.
- Validate file metadata sebelum digunakan.
- Private bucket untuk report attachments.
- GET daftar/detail laporan dan mutation status wajib authenticated admin sistem atau admin desa sebelum deployment publik. FastAPI menegakkan cakupan desa admin.

---

## 20. Pull Request Checklist

Sebelum meminta review:

- [ ] branch bukan `main`;
- [ ] perubahan sesuai scope;
- [ ] no secret;
- [ ] contract update jika diperlukan;
- [ ] frontend lint lolos bila FE berubah;
- [ ] frontend build lolos bila FE berubah;
- [ ] backend pytest lolos bila BE berubah;
- [ ] backend Ruff lolos bila BE berubah;
- [ ] migration file tersedia bila schema berubah;
- [ ] mock/test ikut diperbarui bila contract berubah;
- [ ] tidak ada duplicate naming/domain model baru.

---

## 21. Definition of Done — Code Change

Suatu task dianggap selesai jika:

```text
implementation
+ test/lint/build
+ contract compatibility
+ docs bila shared behavior berubah
+ PR
```

“Berjalan di laptop saya” tidak cukup jika dependency/command tidak reproducible pada anggota lain.
