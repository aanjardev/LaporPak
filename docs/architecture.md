# LaporPak — Architecture

> **Document status:** Canonical architecture baseline.  
> **Contract version:** `0.2.0`

---

## 1. Architecture Style

LaporPak menggunakan **modular monolith** untuk MVP.

Tujuannya:

- cepat dikembangkan oleh tim kecil;
- boundary tetap jelas;
- tidak memecah service terlalu dini;
- mudah di-deploy;
- tetap dapat diekstrak menjadi service terpisah bila dibutuhkan nanti.

Tidak ada requirement microservice untuk Day 1.

---

## 2. Runtime Topology

### Development

```text
Browser
   ↓
Next.js :3000
   ↓ HTTP
FastAPI :8000
   ↓
Supabase PostgreSQL

WhatsApp → OpenClaw ── Gemini API (analisis)
                     ↓ approved tool/API
                   FastAPI
```

WhatsApp/OpenClaw dapat dikembangkan paralel sampai public backend siap.

### Deployment target

```text
                    GitHub
                       │
              ┌────────┴────────┐
              ↓                 ↓
           Vercel            Railway
           Next.js           FastAPI
              │                 │
              └────────┬────────┘
                       ↓
                    Supabase
                       │
             PostgreSQL / Storage
                       │
             pgvector / PostGIS (bila dibutuhkan)

WhatsApp ↔ OpenClaw ── Gemini
                │ approved tool/API
                └──────────────→ FastAPI
```

Docker bukan dependency Day 1.

---

## 3. Component Boundaries

### 3.1 Frontend — `apps/dashboard`

Responsibility:

- Government Dashboard;
- report list;
- report detail;
- operator actions;
- loading/error/empty state;
- HTTP API client.

Frontend tidak melakukan direct write ke Supabase PostgreSQL.

Canonical dependency:

```text
Next.js
  ↓
FastAPI
```

Bukan:

```text
Next.js
  ↓
database langsung
```

---

### 3.2 Backend — `services/api`

FastAPI adalah authoritative application layer.

Responsibility:

- request validation;
- Pydantic schema;
- report creation;
- ticket number generation;
- status transition;
- database transaction;
- idempotency;
- authorization boundary;
- history;
- error handling;
- approved tools untuk OpenClaw.

OpenClaw adalah pemanggil Gemini untuk MVP. FastAPI menerima output terstruktur sebagai data tidak tepercaya, memvalidasinya, lalu menerapkan aturan bisnis. Jangan membuat jalur panggilan Gemini kedua di FastAPI tanpa keputusan arsitektur baru.

---

### 3.3 AI Logic

Validasi output AI dan logika bisnis yang memakai hasil AI berada di backend modular service layer, misalnya:

```text
services/api/app/services/ai/
```

Responsibility:

- schema validation atas intent, extraction, summary, dan clarification suggestion dari OpenClaw;
- advisory urgency/category;
- advisory confidence.

AI tidak boleh:

- menggunakan database credential;
- menjalankan SQL;
- mutate report status;
- approve/reject;
- menghasilkan ticket number authoritative.

---

### 3.4 OpenClaw

OpenClaw adalah **agent gateway/orchestration layer**.

Responsibility:

- menerima event/channel input;
- conversation/session orchestration;
- invoke Gemini;
- invoke allowlisted backend tools;
- mengirim respons ke WhatsApp.

OpenClaw bukan:

- database;
- business rule engine;
- approval authority;
- official status source.

---

### 3.5 WhatsApp

WhatsApp adalah citizen communication channel.

WhatsApp message/event harus diperlakukan sebagai external input yang:

- dapat datang ulang;
- dapat datang out-of-order;
- dapat mengandung data tidak lengkap;
- tidak boleh menyebabkan duplicate operation tanpa idempotency.

---

## 4. Trust Boundaries

```text
UNTRUSTED
Citizen text
WhatsApp event
AI output
uploaded file metadata
        ↓
VALIDATION BOUNDARY
FastAPI + Pydantic + business rules
        ↓
TRUSTED OPERATION
database transaction / status update
```

Prinsip:

> AI output adalah data untuk divalidasi, bukan perintah untuk dieksekusi secara otomatis.

---

## 5. Database Architecture

Supabase PostgreSQL adalah system of record.

### Tables

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

### Main relationships

```text
CITIZENS
   │
   ├──────────────┐
   ↓              ↓
REPORTS     CONVERSATION_SESSIONS
   │              │
   │              ↓
   │        CONVERSATION_MESSAGES
   │              │
   ├──────────────┘
   │
   ├── REPORT_ATTACHMENTS
   └── REPORT_STATUS_HISTORY

REPORT_CATEGORIES
   │
   ├── REPORTS
   └── ROUTING_RULES
          │
          ↓
 ADMINISTRATIVE_UNITS

KNOWLEDGE_DOCUMENTS
   ↓
KNOWLEDGE_CHUNKS
```

`reports.ticket_number` adalah public identifier. `reports.id` tetap UUID internal.

---

## 6. Database Field Baseline

### `citizens`

Key fields:

```text
id
phone_number
display_name
created_at
updated_at
```

### `administrative_units`

```text
id
name
level
parent_id
metadata
is_active
created_at
updated_at
```

### `report_categories`

```text
id
code
name
description
is_active
created_at
updated_at
```

### `reports`

```text
id
ticket_number
citizen_id
category_id
responsible_unit_id
source
status
urgency
original_text
description
summary
location_text
latitude
longitude
ai_extraction
ai_recommendation
verified_at
resolved_at
created_at
updated_at
```

### `report_attachments`

```text
id
report_id
storage_bucket
storage_path
file_name
mime_type
metadata
created_at
```

### `report_status_history`

```text
id
report_id
old_status
new_status
actor_type
actor_identifier
notes
created_at
```

### `conversation_sessions`

```text
id
citizen_id
channel
external_session_id
is_active
metadata
created_at
updated_at
```

### `conversation_messages`

```text
id
session_id
report_id
direction
sender_role
message_type
content
metadata
created_at
```

Untuk deduplikasi event masuk, tambahkan `external_message_id` melalui migration bila dibutuhkan. Idempotensi pembuatan tiket menggunakan ID draf laporan yang stabil dan unik, bukan hanya ID satu pesan WhatsApp.

### `routing_rules`

```text
id
category_id
target_unit_id
priority
conditions
is_active
created_at
updated_at
```

### `knowledge_documents`

```text
id
title
document_type
source_name
source_url
version
metadata
is_active
created_at
updated_at
```

### `knowledge_chunks`

```text
id
document_id
chunk_index
content
metadata
created_at
```

Embedding column ditambahkan saat RAG benar-benar masuk scope.

---

## 7. Extensions

Ekstensi yang direncanakan jika dibutuhkan:

```text
pgvector
PostGIS
```

Keduanya belum terverifikasi aktif di database proyek dan bukan syarat P0 REPORT. Aktifkan melalui migration serta verifikasi di Supabase saat fitur terkait mulai dikerjakan. Day 1 tidak mengharuskan:

- embedding vectors sudah diisi;
- spatial polygon matching sudah lengkap.

Gunakan migration berikutnya untuk menambahkan field/index ketika desain retrieval/routing sudah final.

---

## 8. REPORT Write Flow

```text
Citizen confirms
      ↓
OpenClaw invokes approved create-report tool
      ↓
FastAPI validates request
      ↓
Backend validates required fields
      ↓
Backend resolves category/citizen
      ↓
Idempotency check dengan ID draf laporan yang stabil
      ↓
Database transaction
      ├── insert reports
      └── insert initial status history
      ↓
Commit succeeds
      ↓
Return report id + ticket number
      ↓
Citizen may be told success
```

Tidak boleh memberitahu success sebelum commit berhasil.

---

## 9. Ticket Number

Ticket number:

```text
LP-{YEAR}-{SEQUENCE}
```

Contoh:

```text
LP-2026-0001
```

Rules:

- generated server-side;
- unique;
- immutable;
- concurrency-safe;
- tidak pernah dipercaya dari client/AI payload.

Implementasi sequence dapat ditentukan backend/database, tetapi uniqueness harus enforced oleh database.

---

## 10. Report State Model

Canonical states:

```text
pending_verification
verified
in_progress
forwarded
resolved
rejected
```

Baseline transitions:

```text
pending_verification
   ├──→ verified
   └──→ rejected

verified
   └──→ in_progress

in_progress
   ├──→ forwarded
   └──→ resolved

forwarded
   └──→ resolved
```

Perubahan di luar transition map ditolak backend.

---

## 11. AI Guardrails

1. AI output is untrusted.
2. Structured output wajib divalidasi.
3. Backend menghitung ulang missing required fields.
4. Confidence AI adalah advisory metadata.
5. AI tidak memiliki operational authorization.
6. AI tidak mutate database/status.
7. AI tidak approve/reject.
8. Tool calls hanya allowlisted.
9. Prompt/user text tidak dapat menambah permission.
10. Secret tidak masuk prompt.
11. Jika AI gagal, jangan fabricate hasil.
12. Jika model ambigu, fail-safe ke clarification/manual handling.
13. AI recommendation dapat di-override backend/human.
14. Official status hanya berasal dari database.
15. Citizen confirmation diperlukan sebelum report creation pada golden path.

---

## 12. Confidence Policy

Model boleh menghasilkan:

```json
{
  "confidence": 0.84
}
```

Tetapi angka tersebut **bukan probability terkalibrasi** dan tidak boleh menjadi satu-satunya safety gate.

Baseline heuristic untuk experiment dapat menggunakan:

```text
0.80
```

Namun keputusan untuk lanjut harus mempertimbangkan:

```text
schema valid
required fields complete
ambiguity
business rules
confirmation
```

---

## 13. Required-Field Authority

AI boleh menghasilkan:

```json
{
  "missing_fields": []
}
```

Backend tetap harus memeriksa:

```text
citizen
category
description
location
```

Backend adalah authority untuk completeness.

---

## 14. Duplicate Model

Pisahkan dua jenis duplicate.

### Technical duplicate

Event/request yang sama diproses dua kali.

Penanganan:

```text
ID draf laporan unik untuk create; external message id untuk deduplikasi event masuk
```

Harus dicegah deterministik.

### Semantic duplicate

Dua laporan berbeda yang mungkin membahas kejadian sama.

Penanganan P0:

```text
flag potential duplicate
```

Jangan otomatis menolak report.

---

## 15. Attachments

Binary disimpan di:

```text
Supabase Storage
```

Metadata/reference disimpan di:

```text
report_attachments
```

Recommended bucket:

```text
report-attachments
```

Bucket bersifat private.

---

## 16. Authentication Boundary

Day 1 dapat melakukan local development sebelum auth dashboard selesai.

Baseline autentikasi demo P0 menggunakan dua bearer token backend-only yang
berbeda:

```text
OpenClaw token  -> POST report dari kanal WhatsApp
Dashboard token -> GET report dan PATCH status
```

FastAPI memetakan token ke caller/principal dan menegakkan izin endpoint.
Untuk demo satu desa, dashboard principal juga membawa administrative unit
yang diizinkan. Token dashboard hanya boleh digunakan dari server Next.js dan
tidak boleh menjadi environment variable `NEXT_PUBLIC_*`.

Namun sebelum dashboard/API dibuka ke deployment publik:

```text
GET /api/v1/reports
GET /api/v1/reports/{id}
PATCH /api/v1/reports/{id}/status
```

harus dilindungi authenticated admin sistem atau admin desa. Pada tahap satu desa, admin desa hanya melihat data desa tersebut. Saat multi-desa masuk MVP, backend wajib menegakkan cakupan desa untuk setiap read dan mutation; frontend tidak boleh menjadi satu-satunya penjaga akses.

Jangan menganggap obscurity URL sebagai authorization.

---

## 17. Failure Principle

Semua integration mengikuti:

```text
fail closed for operational action
fail clear for user communication
```

Contoh:

- DB gagal → jangan mengklaim report tersimpan.
- AI gagal → jangan mengarang analysis.
- invalid output → jangan execute.
- unauthorized tool → block.
- webhook retry → jangan create duplicate.
