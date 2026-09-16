# AGENTS.md — LaporPak

> **Applies to:** seluruh repository LaporPak.  
> **Purpose:** instruksi utama untuk Codex/AI coding agent dan developer manusia.  
> **Contract version:** `0.2.0`  
> **Day 1 focus:** P0 `REPORT` foundation + parallel core modules. ASK, TRACK, REQUEST, dan multi-desa tetap masuk target MVP.

---

## 1. Read Order

Sebelum mengubah kode, baca dokumen berikut dalam urutan ini:

1. `AGENTS.md`
2. `docs/project-context.md`
3. `docs/architecture.md`
4. `docs/api-contract.md`
5. `docs/workflows.md`
6. `docs/development-rules.md`

Jika terdapat konflik:

- `AGENTS.md` mengatur **cara bekerja dan batasan agent**.
- `docs/api-contract.md` adalah sumber kebenaran untuk **API, enum, payload, dan status transition**.
- `docs/architecture.md` adalah sumber kebenaran untuk **boundary komponen dan data ownership**.
- `docs/workflows.md` adalah sumber kebenaran untuk **alur REPORT dan fallback**.
- `docs/development-rules.md` adalah sumber kebenaran untuk **Git, environment, testing, dependency, dan migration rules**.
- `docs/project-context.md` adalah sumber kebenaran untuk **tujuan produk, scope, dan Definition of Done Day 1**.
- `docs/prd/PRD_V3_AI_Village_Service_Agent.md` adalah acuan kebutuhan produk lengkap. `project-context.md` mengatur urutan pengerjaan tanpa menghapus fitur MVP dalam PRD.

Jangan membuat contract baru secara diam-diam jika sesuatu belum tercakup. Catat kebutuhan perubahan, perbarui dokumen terkait, lalu implementasikan.

---

## 2. Project Facts

LaporPak adalah conversational public-service gateway untuk layanan dan pengaduan desa.

### P0

P0 adalah:

```text
REPORT
```

P0 adalah urutan kerja pertama, bukan batas akhir MVP. Setelah REPORT stabil, lanjutkan ASK, TRACK, REQUEST, dan dukungan multi-desa sesuai PRD V3.

Target produk P0:

```text
Citizen
  ↓
WhatsApp
  ↓
OpenClaw ── Gemini (analisis)
  ↓ tool/API
FastAPI
  ↓
Supabase PostgreSQL
  ↓
Government Dashboard
  ↓
Human Verification
```

P0 **bukan** target untuk mengganti keputusan administratif manusia dengan AI.

OpenClaw memanggil Gemini. FastAPI tidak memanggil Gemini pada jalur utama MVP; FastAPI memvalidasi hasil AI dan mengendalikan aksi operasional.

---

## 3. Environment Baseline

Development Day 1 menggunakan:

```text
OS                  Windows
Terminal            Git Bash atau PowerShell
Editor              VS Code
Source control      Git + GitHub
Frontend runtime    Node.js LTS
Frontend package    npm
Backend runtime     Python >= 3.14
Python package      uv
Frontend framework  Next.js + TypeScript
Backend framework   FastAPI + Pydantic
Database            Supabase PostgreSQL
Vector extension    pgvector (bila ASK/RAG memerlukan; belum diverifikasi)
Spatial extension   PostGIS (bila geospasial memerlukan; belum diverifikasi)
Deployment FE       Vercel
Deployment BE       Railway
Container           Tidak diwajibkan untuk MVP
```

Jangan menambahkan Docker/WSL sebagai requirement tanpa keputusan tim.

---

## 4. Repository Layout

Gunakan layout aktual berikut:

```text
LaporPak/
├── apps/
│   └── dashboard/                # Frontend Next.js
│
├── services/
│   └── api/                      # FastAPI + business logic + AI service logic
│       └── app/
│           ├── api/
│           ├── core/
│           ├── db/
│           ├── schemas/
│           └── services/
│               ├── ai/          # Validasi output AI / integrasi OpenClaw bila diperlukan
│               ├── rag/         # RAG logic, bila mulai digunakan
│               └── routing/     # Routing/rule support
│
├── database/
│   ├── migrations/
│   └── seeds/
│
├── data/
│   └── knowledge-base/
│
├── integrations/
│   └── openclaw/                # Secret-free prompts and schema artifacts
│
├── docs/
│   ├── project-context.md
│   ├── architecture.md
│   ├── development-rules.md
│   ├── api-contract.md
│   ├── workflows.md
│   └── prd/PRD_V3_AI_Village_Service_Agent.md
└── AGENTS.md
```

Direktori `services/api/app/services/ai`, `rag`, atau `routing` dapat dibuat saat pertama kali benar-benar dibutuhkan.

Jangan membuat microservice AI terpisah untuk P0 tanpa alasan teknis yang disetujui tim.

---

## 5. Absolute Architecture Rules

Aturan berikut tidak boleh dilanggar:

1. **Frontend tidak menentukan business rule.**
2. **AI tidak memiliki direct database access.**
3. **AI tidak boleh membuat/mengubah operational status secara langsung.**
4. **OpenClaw hanya memanggil backend tool/API yang di-allowlist.**
5. **FastAPI adalah boundary business logic dan validasi operasional.**
6. **Supabase PostgreSQL adalah system of record.**
7. **Status resmi hanya berasal dari database.**
8. **Human/admin tetap memegang approval/verifikasi administratif.**
9. **Semua AI output diperlakukan sebagai untrusted input.**
10. **Semua AI output yang digunakan backend harus lolos Pydantic/schema validation.**
11. **Backend menghitung ulang required-field completeness; jangan percaya `missing_fields` dari AI secara buta.**
12. **Backend tidak boleh mengklaim ticket berhasil sebelum persistence berhasil.**
13. **Secret tidak boleh masuk frontend, source code, prompt, Git, atau log.**
14. **Webhook/event retry harus idempotent.**
15. **Semantic duplicate tidak boleh otomatis menghapus/menolak laporan P0.**
16. **GET daftar/detail laporan dan perubahan status hanya untuk admin sistem atau admin desa yang berwenang.**
17. **Identitas pengirim WhatsApp berasal dari metadata kanal terautentikasi; FastAPI menentukan `citizen_id`.**

---

## 6. Canonical Terms

Gunakan istilah ini secara konsisten.

### Intent

```text
ASK
REPORT
REQUEST
TRACK
UNKNOWN
```

P0 mengimplementasikan:

```text
REPORT
UNKNOWN
```

### Report status

Gunakan lowercase pada API/backend/database:

```text
pending_verification
verified
in_progress
forwarded
resolved
rejected
```

### Urgency

```text
low
medium
high
critical
```

AI hanya memberi rekomendasi urgency.

### Report category code

Canonical seed:

```text
infrastructure
public_facility
cleanliness
security
social
administration
other
```

Jangan membuat enum lain seperti `ROAD_DAMAGE` atau `road_damage` tanpa mengubah contract dan seed secara resmi.

---

## 7. P0 Required Data

Sebelum report dapat dibuat:

```text
citizen
category
description
location
```

Location dianggap tersedia bila setidaknya salah satu terpenuhi:

- `location_text` tidak kosong; atau
- `latitude` dan `longitude` keduanya tersedia dan valid.

Attachment dan urgency bukan mandatory input citizen.

AI dapat menyarankan nilai, tetapi backend menentukan apakah data sudah cukup.

---

## 8. Role Boundaries

### Frontend

Ownership utama:

```text
apps/dashboard/
```

Boleh:

- render dashboard;
- report list/detail;
- loading/error/empty state;
- call FastAPI;
- mengelola state UI;
- menggunakan mock sesuai API contract.

Tidak boleh:

- menulis langsung ke database;
- menentukan state transition sendiri;
- menyimpan backend secret;
- menganggap AI recommendation sebagai status resmi.

### Backend

Ownership utama:

```text
services/api/
database/
```

Bertanggung jawab atas:

- Pydantic validation;
- business rule;
- database access;
- status transition;
- ticket number;
- report persistence;
- idempotency;
- minimum audit/status history;
- authorization boundary;
- failure handling.

### AI

Ownership utama:

```text
services/api/app/services/ai/
data/knowledge-base/
```

Farel juga mengelola konfigurasi/flow OpenClaw dan pemanggilan Gemini. Modul backend di atas dipakai untuk schema validation dan logika hasil AI bila diperlukan; jangan membuat pemanggil Gemini kedua di FastAPI.

Bertanggung jawab atas:

- intent understanding;
- extraction;
- clarification recommendation;
- summary;
- advisory confidence;
- advisory urgency/category.

Tidak boleh:

- direct DB;
- approve/reject;
- mutate status;
- bypass backend/tool permission.

### OpenClaw

OpenClaw adalah **agent gateway/orchestration layer**, bukan system of record dan bukan WhatsApp itu sendiri.

---

## 9. Current Database Baseline

Schema Day 1 yang sudah menjadi baseline:

```text
citizens
administrative_units
report_categories
reports
report_attachments
report_status_history
conversation_sessions
conversation_messages
routing_rules
knowledge_documents
knowledge_chunks
```

Ketersediaan `pgvector` dan `PostGIS` belum diverifikasi. Aktifkan melalui migration saat ASK/RAG atau kebutuhan geospasial benar-benar memerlukannya; keduanya bukan prasyarat REPORT.

Jangan mengganti `reports` menjadi `tickets`. `ticket_number` adalah public identifier milik entity `reports`.

---

## 10. Coding Agent Workflow

Sebelum mengedit:

1. Identifikasi role dan folder yang relevan.
2. Baca contract terkait.
3. Pastikan branch bukan `main`.
4. Periksa apakah perubahan menyentuh shared contract.
5. Jika shared contract berubah, update dokumen terlebih dahulu atau dalam PR yang sama.

Setelah mengedit:

### Frontend

```bash
cd apps/dashboard
npm run lint
npm run build
```

### Backend

```bash
cd services/api
uv sync
uv run pytest
uv run ruff check .
```

Perubahan belum dianggap selesai jika test/lint/build gagal.

---

## 11. Git Rules

Workflow resmi:

```text
main
├── feat/...
├── fix/...
├── docs/...
└── refactor/...
```

Tidak menggunakan branch `develop` untuk Day 1.

Flow:

```text
main
  ↓
feature branch
  ↓
commit
  ↓
push
  ↓
Pull Request
  ↓
review
  ↓
main
```

Jangan push langsung ke `main`.

---

## 12. Database Migration Rules

- Migration yang sudah dijalankan **tidak diedit untuk perubahan baru**.
- Gunakan nomor migration berikutnya.

Contoh:

```text
0001_core_schema.sql
0002_add_audit_logs.sql
0003_add_knowledge_embeddings.sql
```

- Seed harus idempotent bila memungkinkan.
- Jangan menyimpan secret/database password di migration.
- Jangan membuat schema baru yang bertentangan dengan `api-contract.md`.

---

## 13. Secret Rules

Frontend hanya boleh menerima variable yang memang public, misalnya:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Backend secret hanya di:

```text
services/api/.env
```

Contoh backend-only:

```text
DATABASE_URL
SUPABASE_SERVICE_ROLE_KEY
WHATSAPP_ACCESS_TOKEN
OPENCLAW_API_KEY
```

`GEMINI_API_KEY` hanya dikonfigurasi pada OpenClaw/integrasi AI yang memanggil Gemini, bukan sebagai kebutuhan runtime FastAPI.

`.env` dan `.env.local` tidak boleh di-commit.

---

## 14. Contract Change Protocol

Perubahan berikut dianggap shared contract change:

- field request/response;
- enum;
- database field yang dipakai lintas role;
- status transition;
- AI structured output;
- endpoint path;
- error code;
- category code.

Prosedur:

1. Jelaskan perubahan.
2. Update dokumen source of truth.
3. Komunikasikan ke FE/BE/AI.
4. Update mock/test.
5. Implementasikan.
6. Pastikan lint/test/build.
7. Merge melalui PR.

---

## 15. Do Not Overengineer

Untuk P0 jangan menambahkan tanpa kebutuhan nyata:

- Kubernetes;
- Docker Compose;
- Redis;
- Celery;
- message broker;
- microservice AI terpisah;
- multi-village tenancy penuh;
- advanced analytics;
- advanced routing engine;
- advanced semantic duplicate rejection.

Prioritas adalah vertical slice REPORT yang dapat dipahami, diuji, dan didemokan.

---

## 16. Minimal Implementation Rules

Untuk implementasi, gunakan prinsip Ponytail: pahami flow yang disentuh, lalu
berhenti pada solusi paling awal yang sudah memenuhi kebutuhan.

1. Jangan membangun kebutuhan spekulatif.
2. Gunakan kembali pattern atau helper repository yang sudah ada.
3. Dahulukan standard library dan kemampuan native platform.
4. Gunakan dependency yang sudah terpasang sebelum menambah dependency baru.
5. Hindari abstraction, boilerplate, atau config yang baru punya satu use case.
6. Untuk logic non-trivial, sisakan test runnable terkecil yang membuktikannya.

Minimalisme tidak boleh mengurangi validation pada trust boundary, error
handling yang mencegah kehilangan data, security, authorization, idempotency,
atau requirement eksplisit. Tandai simplification dengan batas nyata memakai
komentar `ponytail:` yang menjelaskan kapan implementasi perlu ditingkatkan.
