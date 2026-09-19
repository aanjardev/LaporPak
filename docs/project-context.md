# LaporPak — Project Context

> **Document status:** Source of truth untuk tujuan produk, scope, dan Day 1 outcome.  
> **Contract version:** `0.2.0`

---

## 1. Product Summary

LaporPak adalah **conversational public-service gateway** berbasis WhatsApp untuk menjembatani komunikasi natural warga dengan workflow pelayanan pemerintah desa.

Masalah yang diselesaikan bukan sekadar ketiadaan kanal digital. Masalah utamanya adalah:

```text
Warga menyampaikan masalah secara natural
                ↓
informasi tidak selalu lengkap/terstruktur
                ↓
perangkat desa harus melakukan klarifikasi,
pencatatan, kategorisasi, verifikasi, prioritisasi,
dan penentuan pihak yang relevan
```

LaporPak mengubah percakapan warga menjadi data pelayanan yang lebih terstruktur tanpa menyerahkan keputusan administratif kepada AI.

---

## 2. Users

### Citizen / Warga

Membutuhkan:

- kanal yang familiar;
- bahasa natural;
- tidak perlu mengisi formulir rumit;
- konfirmasi bahwa laporan tercatat;
- nomor ticket;
- keterlacakan status.

### Government Operator / Perangkat Desa

Membutuhkan:

- report terstruktur;
- kategori;
- lokasi;
- ringkasan;
- rekomendasi AI;
- history;
- status workflow;
- human verification.

---

## 3. Product Capabilities

LaporPak memiliki empat capability:

```text
ASK
REPORT
REQUEST
TRACK
```

Urutan pengembangan MVP:

| Capability | Prioritas kerja | Day 1 |
|---|---|---|
| REPORT | P0 | Foundation + core parallel work |
| ASK | Setelah REPORT | Kontrak disiapkan bila diperlukan |
| TRACK | Setelah REPORT | Kontrak disiapkan bila diperlukan |
| REQUEST | Setelah REPORT | Kontrak disiapkan bila diperlukan |

Dukungan multi-desa juga termasuk target MVP, tetapi diimplementasikan setelah alur REPORT satu desa stabil. Urutan ini tidak menghapus ASK, TRACK, REQUEST, atau multi-desa dari MVP. Jika REPORT selesai lebih cepat, tim langsung melanjutkan kemampuan berikutnya.

---

## 4. P0 — REPORT

Target akhir P0:

```text
Citizen
  ↓
WhatsApp
  ↓
OpenClaw
  ↓
Gemini understanding/extraction
  ↓
OpenClaw provisional completeness check
  ↓
Citizen confirmation
  ↓
FastAPI authoritative validation
  ↓
Report persisted
  ↓
Ticket number
  ↓
Dashboard
  ↓
Human verification
  ↓
Status update
```

### P0 includes

- intent `REPORT`;
- `UNKNOWN` fallback;
- extraction;
- missing-data handling;
- confirmation;
- report creation;
- dashboard list/detail;
- verification;
- controlled status transition;
- minimum history/auditability.

### Di luar P0

- ASK, TRACK, dan REQUEST;
- advanced RAG;
- complex routing;
- advanced semantic duplicate engine;
- analytics;
- multi-village tenancy;
- complex infrastructure.

ASK, TRACK, REQUEST, dan multi-desa tetap target MVP. Autentikasi dan pembatasan akses admin untuk REPORT wajib ada sebelum deployment publik, meskipun desain otorisasi yang lebih luas dapat berkembang kemudian.

---

## 5. Day 1 Is Two Layers

Agar scope tidak rancu, Day 1 dibagi menjadi:

### Layer A — Foundation Gate

Foundation harus siap sebelum vertical integration serius.

#### Environment

- [x] Git
- [x] Node.js LTS
- [x] Python >= 3.14
- [x] VS Code

#### Repository

- [x] GitHub
- [x] Monorepo
- [x] Branch strategy
- [x] `.gitignore`

#### Frontend foundation

- [x] Next.js dapat berjalan

#### Backend foundation

- [x] FastAPI dapat berjalan
- [x] Pydantic tersedia
- [x] `GET /health`

#### Database foundation

- [x] Supabase project
- [x] PostgreSQL connection
- [x] Initial schema

Migration ASK sekarang meminta `pgvector`, tetapi keberhasilannya tetap harus
diverifikasi pada setiap environment Supabase. `PostGIS` belum menjadi baseline
migration. Keduanya bukan gerbang Day 1 REPORT.

#### AI foundation

- [x] Gemini connectivity melalui OpenClaw
- [x] OpenClaw baseline
- [x] WhatsApp development channel/connectivity

#### Design foundation

- [x] Database/ERD baseline
- [x] API contract
- [x] Application flow
- [x] AI guardrail

---

### Layer B — Parallel Core Work

Setelah foundation siap, tiga role dapat bergerak paralel.

#### Frontend

Target:

- dashboard shell;
- reports list;
- report detail;
- mock data mengikuti `api-contract.md`;
- loading/error/empty states;
- API abstraction.

#### Backend

Target:

- report schemas;
- `POST /api/v1/reports`;
- `GET /api/v1/reports`;
- `GET /api/v1/reports/{id}`;
- `PATCH /api/v1/reports/{id}/status`;
- database persistence;
- status history;
- validation.

#### AI

Target:

- Gemini connection;
- REPORT/UNKNOWN classification;
- structured extraction;
- missing-field advisory;
- summary;
- fallback;
- baseline OpenClaw flow;
- AI test cases.

---

## 6. Day 1 Outcome

Day 1 **tidak wajib** menghasilkan WhatsApp → database end-to-end yang sempurna.

Outcome ideal:

```text
Frontend
  └── bekerja dengan mock sesuai contract

Backend
  └── real API + real database

AI
  └── real structured output sesuai contract

Shared contract
  └── freeze dan tidak mismatch
```

Integration paper/mock minimum:

```text
AI JSON
   ↓
POST /api/v1/reports
   ↓
Supabase
   ↓
GET /api/v1/reports
   ↓
Frontend
```

Day 2 dapat fokus pada vertical integration, bukan mendebat schema dan naming.

---

## 7. Environment Decision

Project menggunakan development environment sederhana:

```text
Windows
Git Bash atau PowerShell
VS Code
GitHub
Node.js LTS
npm
Python >= 3.14
uv
```

Tidak diwajibkan:

```text
Docker
WSL/Ubuntu
local PostgreSQL
Vercel CLI
Railway CLI
Supabase CLI
```

Managed services:

```text
Frontend production  → Vercel
Backend production   → Railway
Database             → Supabase
AI                   → OpenClaw memanggil Gemini API
```

---

## 8. Monorepo

Canonical root layout:

```text
LaporPak/
├── apps/
│   └── dashboard/
├── services/
│   └── api/
├── database/
│   ├── migrations/
│   └── seeds/
├── data/
│   └── knowledge-base/
└── docs/
```

Meaning:

```text
apps       = user-facing application
services   = backend + AI service logic
database   = versioned SQL schema/seed
data       = approved AI/RAG source material
docs       = design and supporting documentation
```

---

## 9. Architecture Principle

AI berada pada posisi:

```text
understand
extract
summarize
recommend
```

Backend berada pada posisi:

```text
validate
authorize
persist
apply rules
control state
```

Human berada pada posisi:

```text
verify
approve/reject
make operational decisions
```

Database berada pada posisi:

```text
official operational truth
```

---

## 10. MVP Tenancy Assumption

Day 1 dan P0 menggunakan **asumsi satu desa untuk tahap awal MVP**.

Entity desa memakai `administrative_units`; jangan membuat tabel `villages`
paralel. Baseline sekarang memiliki akun admin, membership unit, channel scope,
serta unit pada REPORT, knowledge, dan REQUEST. Multi-desa tetap belum selesai
sampai isolasi dua desa lulus pada setiap query, detail, mutation, dan tool.

---

## 11. Current Database Baseline

Current schema baseline:

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
admin_accounts
admin_unit_memberships
channel_integrations
service_request_types
service_requests
service_request_status_history
village_profiles
knowledge_templates
knowledge_analytics
resolution_confirmations
```

Jangan menambah tabel duplikat untuk entity yang sama. `administrative_units`
adalah scope canonical; `admin_accounts` dan `admin_unit_memberships` adalah
boundary akses dashboard.

Untuk P0, `report_status_history` adalah minimum audit trail status.

---

## 12. Canonical Report Categories

Seed awal:

```text
infrastructure
public_facility
cleanliness
security
social
administration
other
```

Category adalah domain contract, bukan label bebas buatan masing-masing role.

---

## 13. Success Criteria P0

P0 dianggap berhasil ketika vertical slice berikut dapat didemokan:

```text
Citizen message
      ↓
REPORT understood
      ↓
required information collected
      ↓
citizen confirms summary
      ↓
backend creates report
      ↓
ticket number returned
      ↓
dashboard shows report
      ↓
operator verifies
      ↓
status update persisted
```

Semua langkah operasional penting harus tetap dikontrol backend/human.
