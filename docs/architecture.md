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
- sesi admin Supabase Auth invite-only;
- daftar, detail, dan aksi status REPORT;
- pengelolaan sumber ASK melalui FastAPI;
- antrean, detail, dan keputusan REQUEST melalui FastAPI;
- loading/error/empty state;
- HTTP API client.

REQUEST sudah terhubung secara teknis. Penggunaan data warga nyata tetap
menunggu SOP, field minimum, dan kewenangan petugas disahkan.

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
- ASK retrieval dan TRACK berbasis kepemilikan warga;
- pengelolaan knowledge;
- REQUEST `residency_letter` dan approval gate petugas.

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
   ├── REPORT_STATUS_HISTORY
   └── RESOLUTION_CONFIRMATIONS

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

ADMIN_ACCOUNTS
   ↓
ADMIN_UNIT_MEMBERSHIPS ──→ ADMINISTRATIVE_UNITS

CHANNEL_INTEGRATIONS ──→ ADMINISTRATIVE_UNITS

CITIZENS ──→ SERVICE_REQUESTS ──→ SERVICE_REQUEST_STATUS_HISTORY
                    ↑
          SERVICE_REQUEST_TYPES
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
administrative_unit_id
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
idempotency_key
idempotency_payload_hash
sla_deadline
is_emergency
location_hash
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
external_message_id
metadata
created_at
```

`external_message_id` mendeduplikasi event kanal masuk. Idempotensi pembuatan
tiket menggunakan `reports.idempotency_key`, yaitu ID draf laporan yang stabil
dan unik, bukan hanya ID satu pesan WhatsApp. Payload hash membedakan retry
valid dari penggunaan key yang sama untuk payload berbeda.

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
administrative_unit_id
category
content
source_type
storage_bucket
storage_path
is_mandatory
processing_status
checksum
failure_message
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
checksum
embedding
search_vector
created_at
```

`administrative_unit_id` adalah scope canonical yang dipakai route knowledge.
Kolom `village_id` juga ada dari migration 0008, tetapi tidak digunakan oleh
schema runtime saat ini. Hindari logika scope ganda sebelum ada migrasi
konsolidasi dan perubahan kontrak resmi.

### `admin_accounts` dan `admin_unit_memberships`

```text
admin_accounts: id, auth_user_id, role, display_name, is_active, created_at, updated_at
admin_unit_memberships: admin_account_id, administrative_unit_id, created_at
```

Role canonical adalah `system_admin` dan `village_admin`. FastAPI memakai
membership untuk membatasi baca dan mutation per desa.

`village_admin` adalah operator independen untuk unit pada membership-nya.
`system_admin` hanya menjadi authority aktivasi desa dan pembaca metrik
agregat; role ini tidak memiliki akses detail warga, attachment, knowledge,
atau keputusan REPORT/REQUEST. Akun system admin dibuat lewat provisioning
server, bukan pendaftaran publik.

`administrative_units.activation_status` terpisah dari status koneksi channel
dan status tiket. Riwayat keputusan berada pada
`village_activation_history`. Desa baru belum menjadi scope operasional sampai
status `approved` dan `is_active=true`.

### `channel_integrations`

```text
id
channel
external_account_id
administrative_unit_id
is_active
created_at
updated_at
```

Header channel dari OpenClaw dipetakan ke unit administratif melalui tabel ini.
Payload buatan model tidak boleh memilih desa.

### `service_request_types`, `service_requests`, dan riwayat

```text
service_request_types: id, code, name, is_active, created_at, updated_at
service_requests: id, ticket_number, request_type_id, citizen_id,
  administrative_unit_id, status, applicant_name, domicile_address,
  domicile_duration, purpose, idempotency_key, idempotency_payload_hash,
  created_at, updated_at
service_request_status_history: id, service_request_id, old_status, new_status,
  actor_type, actor_identifier, notes, created_at
```

Baseline teknis saat ini memakai tipe `residency_letter`. SOP, data yang boleh
ditampilkan, dan pejabat pemberi keputusan masih memerlukan persetujuan tim.

Migration knowledge juga membuat `village_profiles`, `knowledge_templates`,
dan `knowledge_analytics`. Ketiganya bukan authority baru untuk scope atau SOP.
Template berisi fakta contoh yang belum disetujui telah dihapus oleh migration
hardening; konten resmi tetap memerlukan review manusia.

### `resolution_confirmations`

```text
id
report_id
confirmed
feedback
created_at
```

Konfirmasi warga adalah evidence tambahan. Konfirmasi tidak mengubah status
resmi REPORT secara langsung.

---

## 7. Extensions

Ekstensi database:

```text
pgvector  -> diminta oleh migration 0005 untuk embedding knowledge 768 dimensi
PostGIS   -> belum menjadi baseline migration
```

Keberhasilan migration dan extension tetap harus diverifikasi pada Supabase
lingkungan yang dipakai tim. ASK memiliki fallback FTS ketika embedding belum
tersedia. PostGIS bukan syarat REPORT atau REQUEST saat ini. Day 1 tidak mengharuskan:

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

Demo P0 menggunakan Supabase Auth invite-only. Next.js menjaga sesi melalui
cookie dan meneruskan access token petugas ke FastAPI melalui
`Authorization: Bearer`. FastAPI memvalidasi token melalui Supabase Auth pada
setiap GET/PATCH dan memakai UUID pengguna sebagai identitas audit. Frontend
tidak membaca tabel laporan langsung dari Supabase.

Baseline autentikasi demo P0 memisahkan credential berdasarkan jalur:

```text
OpenClaw API key       -> POST report dari kanal WhatsApp
Supabase access token  -> GET report dan PATCH status
```

FastAPI memetakan UUID token ke `admin_accounts`, menolak akun nonaktif, dan
memakai `admin_unit_memberships` untuk cakupan `village_admin`.
`system_admin` memiliki cakupan global. Fallback unit dari konfigurasi backend
hanya boleh dipakai untuk development eksplisit melalui
`ALLOW_LEGACY_ADMIN_FALLBACK`; nilai default-nya nonaktif.

Namun sebelum dashboard/API dibuka ke deployment publik:

```text
GET/PATCH /api/v1/reports/...
GET/PATCH /api/v1/service-requests/...
GET/POST/PATCH/DELETE /api/v1/knowledge/...
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
