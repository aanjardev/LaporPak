# LaporPak — API & Data Contract

> **Contract version:** `0.4.0`
> **Status:** Day 1 baseline  
> **Base API:** `/api/v1`

Dokumen ini adalah canonical contract untuk Frontend, Backend, AI integration, dan mock data.

---

## 1. General Conventions

### JSON

- Request/response menggunakan JSON kecuali upload file.
- Field API menggunakan `snake_case`.
- UUID menggunakan string.
- Timestamp menggunakan ISO 8601 UTC bila dikirim lewat API.

### Canonical casing

Status/category/urgency API memakai lowercase.

Intent AI memakai uppercase.

### Autentikasi P0

Endpoint admin P0 menggunakan bearer token backend-only:

```http
Authorization: Bearer <token>
```

Izin caller:

| Caller | Operasi P0 yang diizinkan |
|---|---|
| OpenClaw | Membuat laporan WhatsApp melalui `POST /api/v1/reports` dengan `X-OpenClaw-API-Key` |
| Admin dashboard | Membaca laporan dan mengubah status laporan |

OpenClaw dan dashboard menggunakan secret serta header berbeda. FastAPI
memetakan bearer token dashboard ke identitas admin dan, untuk demo satu desa,
administrative unit yang diizinkan. Token dashboard valid untuk operasi admin
yang tidak diizinkan menghasilkan `403 FORBIDDEN`; credential yang hilang atau
tidak valid menghasilkan `401 UNAUTHORIZED`.

Token dashboard hanya digunakan server Next.js. Token tidak boleh diekspos
melalui `NEXT_PUBLIC_*`, JavaScript browser, source code, atau log. Mekanisme
token sederhana ini adalah baseline demo P0 dan dapat diganti dengan identity
provider lengkap tanpa memindahkan aturan otorisasi ke frontend.

---

## 2. Canonical Enums

### Intent

```text
ASK
REPORT
REQUEST
TRACK
UNKNOWN
```

P0:

```text
REPORT
UNKNOWN
```

### Report status

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

### Source

```text
whatsapp
dashboard
api
seed
```

### Category code

```text
infrastructure
public_facility
cleanliness
security
social
administration
other
```

---

## 3. Standard Error Envelope

Semua controlled API error sebaiknya mengikuti:

```json
{
  "error": {
    "code": "REPORT_NOT_FOUND",
    "message": "Report not found",
    "details": null
  }
}
```

`details` boleh object/list/null.

### Minimum error codes

```text
INVALID_REQUEST
UNAUTHORIZED
FORBIDDEN
REPORT_NOT_FOUND
SERVICE_REQUEST_NOT_FOUND
KNOWLEDGE_DOCUMENT_NOT_FOUND
TICKET_NOT_FOUND
ATTACHMENT_UNAVAILABLE
INVALID_STATUS_TRANSITION
DUPLICATE_OPERATION
VALIDATION_ERROR
DATABASE_UNAVAILABLE
AI_UNAVAILABLE
INTERNAL_ERROR
```

Suggested HTTP mapping:

| HTTP | Code |
|---:|---|
| 400 | `INVALID_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `REPORT_NOT_FOUND` |
| 404 | `SERVICE_REQUEST_NOT_FOUND` |
| 404 | `KNOWLEDGE_DOCUMENT_NOT_FOUND` |
| 404 | `TICKET_NOT_FOUND` |
| 409 | `INVALID_STATUS_TRANSITION` |
| 409 | `DUPLICATE_OPERATION` |
| 422 | `VALIDATION_ERROR` |
| 422 | `INVALID_REGION` |
| 422 | `INVALID_REGION_CODE` |
| 503 | `DATABASE_UNAVAILABLE` |
| 503 | `ATTACHMENT_UNAVAILABLE` |
| 503 | `AI_UNAVAILABLE` |
| 503 | `REGION_SERVICE_UNAVAILABLE` |
| 500 | `INTERNAL_ERROR` |

### Autentikasi dan izin REPORT

Akses petugas untuk demo P0 menggunakan akun Supabase Auth yang dibuat melalui
undangan admin. Untuk endpoint GET/PATCH pada bagian 7–9, server Next.js
meneruskan access token sesi petugas:

```http
Authorization: Bearer <supabase_access_token>
```

FastAPI memverifikasi token melalui Supabase Auth, memetakan UUID pengguna ke
`admin_accounts`, menolak akun nonaktif, dan memakai UUID tersebut sebagai
identitas audit. `system_admin` memiliki cakupan global; `village_admin`
dibatasi oleh `admin_unit_memberships`. Akun `system_admin` hanya dibuat lewat
provisioning server; calon `village_admin` dapat mendaftar mandiri atau menerima
undangan lalu tetap melewati verifikasi email dan aktivasi desa.
Fallback `DASHBOARD_ADMIN_UNIT_ID` hanya untuk development legacy ketika
`ALLOW_LEGACY_ADMIN_FALLBACK=true`; default-nya nonaktif dan tidak boleh dipakai
sebagai mekanisme izin production.

| Kondisi | HTTP / code | Perilaku dashboard |
|---|---|---|
| Token tidak ada, tidak valid, atau kedaluwarsa | `401 UNAUTHORIZED` | Arahkan ke login; simpan tujuan lokal agar dapat kembali setelah login. |
| Token valid, tetapi akun admin tidak aktif atau tidak memiliki izin memakai dashboard | `403 FORBIDDEN` | Tampilkan akses ditolak; sesi tetap ada agar petugas dapat logout. |
| ID laporan tidak ada atau berada di luar cakupan desa petugas | `404 REPORT_NOT_FOUND` | Tampilkan laporan tidak ditemukan, tanpa mengungkap keberadaan laporan lintas desa. |

Pemeriksaan detail dan PATCH dilakukan terhadap laporan terkait, bukan berdasarkan filter di frontend. Gunakan error envelope standar di atas. Pada demo satu desa, hanya akun yang dibuat melalui invitation yang diberi akses dashboard.

---

## 4. Health

```http
GET /health
```

Response `200`:

```json
{
  "status": "ok",
  "service": "laporpak-api"
}
```

Health bukan `/api/v1/health` pada baseline saat ini.

---

## 5. Create Report

```http
POST /api/v1/reports
```

### Responsibility

Endpoint membuat entity `reports`.

Ticket number dihasilkan server-side dan **tidak** dikirim client.

### Request

```json
{
  "sender_phone_number": "+6281234567890",
  "conversation_id": "fa5d95ae-514f-4ce0-a3c2-735d8558948b",
  "category": "infrastructure",
  "description": "Jalan di RT 03 rusak parah.",
  "location": {
    "text": "RT 03 dekat masjid",
    "latitude": -7.123,
    "longitude": 112.123
  },
  "urgency": "high",
  "original_text": "Pak jalan di RT 03 dekat masjid rusak parah.",
  "source": "whatsapp",
  "ai_analysis": {
    "confidence": 0.94,
    "summary": "Kerusakan jalan di RT 03 dekat masjid."
  },
  "attachments": [
    {
      "data_base64": "<trusted-staged-whatsapp-image>",
      "mime_type": "image/jpeg",
      "filename": "whatsapp-image-1.jpg",
      "size": 245760
    }
  ]
}
```

### Required before persistence

Authoritative backend requirements:

```text
identitas warga yang dapat dipetakan backend ke citizen_id
category
description
location
attachment (minimal 1 foto)
```

`location` valid jika:

- `text` non-empty; atau
- latitude + longitude valid.

Untuk `source: "whatsapp"`, `sender_phone_number` berasal dari metadata kanal OpenClaw, bukan dari teks warga atau output Gemini. Endpoint ini harus mengautentikasi pemanggil OpenClaw; FastAPI menormalisasi nomor lalu mencari/membuat `citizens` dan menentukan `citizen_id`. Nomor tidak boleh dipercaya jika dikirim oleh client publik. Untuk source lain, identitas warga dan izin pemanggil harus didefinisikan sebelum endpoint tersebut dipakai.

`conversation_id`, `urgency`, `original_text`, dan `ai_analysis` dapat optional sesuai source. `Idempotency-Key` wajib untuk create dari WhatsApp.

Pemanggil OpenClaw wajib mengirim secret internal pada header:

```http
X-OpenClaw-API-Key: <server-only-secret>
X-Channel-Account-ID: <authenticated-channel-account>
```

`Idempotency-Key` adalah UUID stabil yang diturunkan plugin dari metadata sesi
dan media terautentikasi. Semua header tersebut bersifat server-to-server dan
tidak boleh dikirim oleh frontend publik. Backend memetakan channel account ke
unit administratif aktif; model tidak dapat memilih desa.

### Backend behavior

Backend:

1. validates schema;
2. resolves citizen, category, dan unit desa dari metadata kanal;
3. validates required fields;
4. verifies idempotency dalam transaksi;
5. generates unique ticket number;
6. inserts report;
7. inserts initial status history;
8. uploads 1–3 foto ke bucket private `report-attachments` dan menyimpan metadata;
9. returns success only after persistence succeeds.

### Response `201`

```json
{
  "id": "72af1a52-7016-48c7-aacc-6c35417be819",
  "ticket_number": "LP-2026-0001",
  "status": "pending_verification",
  "created_at": "2026-09-16T14:00:00Z"
}
```

---

## 6. Idempotency for Create Report

Satu draf laporan memperoleh satu ID stabil saat OpenClaw mulai mengumpulkan fakta. ID ini dipertahankan saat klarifikasi, konfirmasi, retry, atau warga mengirim jawaban konfirmasi dua kali. Dua laporan berbeda memperoleh ID berbeda.

```http
Idempotency-Key: <plugin-derived-stable-uuid>
```

Backend menyimpan key dengan constraint unik dan mengikatnya ke laporan. Insert laporan, initial status history, dan key harus berhasil dalam satu transaksi. Untuk key dan payload yang sama:

- permintaan pertama menghasilkan `201` dan tiket baru;
- permintaan ulang menghasilkan `200` dengan body tiket yang sudah ada, tanpa laporan/history baru;
- key sama dengan payload berbeda menghasilkan `409 DUPLICATE_OPERATION`.

Database menyimpan UUID draf pada `reports.idempotency_key` dan hash payload
pada `reports.idempotency_payload_hash`. `conversation_messages.external_message_id`
menangani deduplikasi event masuk secara terpisah; ID pesan saja tidak cukup
karena warga dapat mengirim dua pesan konfirmasi untuk satu draf.

---

## 7. List Reports

```http
GET /api/v1/reports
```

Wajib authenticated admin sistem atau admin desa. Backend membatasi data admin desa ke desa yang diizinkan; admin sistem mengikuti cakupan akses yang ditetapkan tim. Saat multi-desa diimplementasikan, filter desa wajib ditegakkan server-side.

### Query

```text
page
page_size
status
urgency
category
search
```

Defaults:

```text
page = 1
page_size = 20
```

Recommended maximum:

```text
page_size <= 100
```

Example:

```http
GET /api/v1/reports?page=1&page_size=20&status=pending_verification&category=infrastructure
```

### Response `200`

```json
{
  "items": [
    {
      "id": "72af1a52-7016-48c7-aacc-6c35417be819",
      "ticket_number": "LP-2026-0001",
      "category": "infrastructure",
      "description": "Jalan di RT 03 rusak parah.",
      "location": {
        "text": "RT 03 dekat masjid",
        "latitude": -7.123,
        "longitude": 112.123
      },
      "urgency": "high",
      "status": "pending_verification",
      "created_at": "2026-09-16T14:00:00Z"
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

Frontend mock harus mengikuti shape ini.

---

## 8. Report Detail

```http
GET /api/v1/reports/{report_id}
```

Wajib authenticated admin sistem atau admin desa dengan akses ke desa pemilik laporan. Laporan di luar cakupan tidak boleh dibocorkan melalui respons.

Response `200`:

```json
{
  "id": "72af1a52-7016-48c7-aacc-6c35417be819",
  "ticket_number": "LP-2026-0001",
  "citizen": {
    "display_name": "Warga"
  },
  "category": "infrastructure",
  "description": "Jalan di RT 03 rusak parah.",
  "summary": "Kerusakan jalan di RT 03 dekat masjid.",
  "location": {
    "text": "RT 03 dekat masjid",
    "latitude": -7.123,
    "longitude": 112.123
  },
  "urgency": "high",
  "status": "pending_verification",
  "responsible_unit": null,
  "ai_recommendation": {},
  "attachments": [
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "file_name": "whatsapp-image-1.jpg",
      "mime_type": "image/jpeg",
      "file_size": 245760,
      "created_at": "2026-09-16T14:00:00Z"
    }
  ],
  "status_history": [
    {
      "old_status": null,
      "new_status": "pending_verification",
      "actor_type": "system",
      "actor_display_name": null,
      "notes": "Report created",
      "created_at": "2026-09-16T14:00:00Z"
    }
  ],
  "allowed_transitions": ["verified", "rejected"],
  "verified_at": null,
  "resolved_at": null,
  "created_at": "2026-09-16T14:00:00Z",
  "updated_at": "2026-09-16T14:00:00Z"
}
```

`responsible_unit` bernilai `null` bila belum ditetapkan. Jika tersedia,
backend mengirim objek `{ "id": "<uuid>", "name": "<nama unit>" }`.
Metadata attachment tidak pernah memuat `storage_bucket`, `storage_path`, URL
bucket, atau metadata internal.
Riwayat hanya mengekspos nama aktor yang aman; UUID warga, UUID akun Supabase,
dan `actor_identifier` mentah bukan bagian dari response. Dashboard hanya boleh
menawarkan aksi status dari `allowed_transitions` yang dihitung backend.

Jika tidak ada:

```http
404 REPORT_NOT_FOUND
```

### Read private report attachment

```http
GET /api/v1/reports/{report_id}/attachments/{attachment_id}
Authorization: Bearer <supabase-admin-access-token>
```

Endpoint memeriksa bahwa attachment adalah milik laporan dan bahwa admin sistem
atau admin desa memiliki akses ke desa pemilik laporan pada setiap request.
Respons `200` berisi bytes gambar privat, `Content-Type` sesuai metadata yang
tersimpan, dan `Content-Disposition: inline`. Backend tidak memberikan signed
URL atau path bucket kepada client.

Laporan yang tidak ada/di luar cakupan, attachment yang tidak ada, dan
attachment milik laporan lain semuanya menghasilkan `404 REPORT_NOT_FOUND`.
Kegagalan membaca private storage menghasilkan `503 ATTACHMENT_UNAVAILABLE`
tanpa membocorkan detail storage.

---

## 9. Update Report Status

```http
PATCH /api/v1/reports/{report_id}/status
```

### Request

```json
{
  "status": "verified",
  "reason": "Laporan telah diverifikasi oleh operator."
}
```

Backend tidak menerima arbitrary status.

### Allowed baseline transitions

```text
pending_verification → verified
pending_verification → rejected
verified             → in_progress
in_progress          → forwarded
in_progress          → resolved
forwarded            → resolved
```

Invalid transition:

```http
409 INVALID_STATUS_TRANSITION
```

### Response `200`

```json
{
  "id": "72af1a52-7016-48c7-aacc-6c35417be819",
  "ticket_number": "LP-2026-0001",
  "status": "verified",
  "updated_at": "2026-09-16T15:00:00Z"
}
```

Status mutation harus menulis `report_status_history`.

Sebelum endpoint dibuka ke deployment publik, mutation ini wajib membutuhkan authenticated admin sistem atau admin desa yang berwenang atas laporan tersebut. FastAPI memeriksa role dan cakupan desa, bukan hanya status login.

---

## 10. Internal AI Output Contract

AI analysis bukan operational truth.

Canonical P0 analysis:

```json
{
  "intent": "REPORT",
  "confidence": 0.94,
  "category": "infrastructure",
  "description": "Jalan di RT 03 rusak parah.",
  "location": {
    "text": "RT 03 dekat masjid",
    "latitude": null,
    "longitude": null
  },
  "urgency": "high",
  "missing_fields": [],
  "needs_clarification": false,
  "clarification_reason": null,
  "summary": "Kerusakan jalan di RT 03 dekat masjid."
}
```

### Schema

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `intent` | enum | yes | `REPORT` atau `UNKNOWN` pada P0 |
| `confidence` | float 0..1 | yes | advisory model confidence |
| `category` | enum/null | yes | canonical category code atau null |
| `description` | string/null | yes | extracted description |
| `location` | object/null | yes | extracted location |
| `urgency` | enum/null | yes | advisory urgency |
| `missing_fields` | array[string] | yes | AI suggestion |
| `needs_clarification` | bool | yes | AI suggestion |
| `clarification_reason` | string/null | yes | reason |
| `summary` | string/null | yes | generated summary |

`location`, bila tidak `null`, selalu memiliki ketiga key berikut. Nilainya
boleh `null` agar hasil ekstraksi yang belum lengkap tetap dapat divalidasi dan
diteruskan ke alur klarifikasi.

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `text` | string/null | yes | lokasi tekstual dari input warga |
| `latitude` | number/null | yes | latitude pada rentang `-90..90` |
| `longitude` | number/null | yes | longitude pada rentang `-180..180` |

Semua object pada Internal AI Output menolak field yang tidak tercantum dalam
contract. String non-null harus berisi teks, bukan string kosong/whitespace.
Output boleh valid secara schema tetapi belum lengkap secara bisnis; OpenClaw
melakukan pemeriksaan provisional dan FastAPI menghitung ulang kelengkapan saat
create report.

### Important

Backend tetap menghitung ulang:

```text
required fields
category validity
location validity
status permission
```

`confidence >= 0.80` boleh dipakai sebagai heuristic eksperimen, tetapi bukan satu-satunya gate.

---

## 11. UNKNOWN Handling

Jika input bukan REPORT yang cukup jelas:

```json
{
  "intent": "UNKNOWN",
  "confidence": 0.55,
  "category": null,
  "description": null,
  "location": null,
  "urgency": null,
  "missing_fields": [],
  "needs_clarification": true,
  "clarification_reason": "Intent belum dapat dipastikan.",
  "summary": null
}
```

Jangan create report dari `UNKNOWN`.

---

## 12. Category Resolution

AI/API menggunakan `category` sebagai canonical code:

```text
infrastructure
public_facility
cleanliness
security
social
administration
other
```

Backend resolve:

```text
category code
      ↓
report_categories.id
      ↓
reports.category_id
```

Frontend tidak perlu mengetahui UUID category untuk P0.

---

## 13. Location Mapping

API location:

```json
{
  "text": "RT 03 dekat masjid",
  "latitude": -7.123,
  "longitude": 112.123
}
```

Database mapping:

```text
text      → reports.location_text
latitude  → reports.latitude
longitude → reports.longitude
```

Validation:

```text
-90 <= latitude <= 90
-180 <= longitude <= 180
```

---

## 14. AI Metadata Mapping

AI operational recommendation dapat disimpan sebagai metadata:

```text
reports.ai_extraction
reports.ai_recommendation
```

Metadata ini bukan pengganti:

```text
reports.status
reports.category_id
reports.responsible_unit_id
```

untuk state yang sudah divalidasi backend/human.

---

## 15. Attachment Contract

OpenClaw membaca foto dari staged media path yang disediakan runtime kanal,
kemudian mengirimkannya server-to-server sebagai base64. Model tidak dapat
memberikan path, URL, atau bytes attachment. API menerima 1–3 gambar JPEG,
PNG, atau WebP dengan ukuran maksimal 5 MB per gambar dan memverifikasi magic
bytes sebelum menyimpan.

Storage:

```text
Supabase Storage / report-attachments
```

Database:

```text
report_attachments
```

Do not embed binary/base64 ke `reports` JSON.

---

## 16. Citizen APIs

- `POST /api/v1/ask` mengambil evidence dari knowledge source aktif dalam
  cakupan channel. `query_embedding` optional; tanpa embedding backend memakai
  FTS, dan dengan embedding backend memakai hybrid retrieval.
- `POST /api/v1/track` hanya membaca REPORT atau REQUEST milik nomor WhatsApp
  terautentikasi dalam unit channel yang sama.
- `POST /api/v1/service-requests` membuat REQUEST sesuai contract layanan.
- `POST /api/v1/detect-emergency`, `/api/v1/check-similar`, dan
  `/api/v1/confirm-resolution/{ticket_number}` adalah advisory/support flow;
  endpoint tersebut tidak dapat mengubah status resmi laporan.

TRACK mengembalikan `404 TICKET_NOT_FOUND` untuk tiket yang tidak ada, milik
pengirim lain, atau berasal dari desa lain, serta `503 DATABASE_UNAVAILABLE`
untuk kegagalan database. Konfirmasi penyelesaian mengembalikan
`404 REPORT_NOT_FOUND` bila ownership/scope tidak cocok,
`409 INVALID_STATUS_TRANSITION` sebelum laporan berstatus `resolved`,
`422 VALIDATION_ERROR` untuk input tidak valid, dan
`503 DATABASE_UNAVAILABLE` untuk kegagalan persistence.

Untuk item REPORT yang memiliki rujukan, TRACK boleh menyertakan `referral`
yang hanya berisi `dispatch_status`, `registration_status`,
`handling_status`, `next_step`, dan `updated_at`. Response ini tidak memuat
nama/URL kanal, tujuan internal, referensi eksternal, bukti internal, actor,
atau identitas petugas. Rujukan dicari setelah ownership REPORT dan scope desa
terverifikasi; REQUEST tidak menerima field ini.

---

## 17. Production Backend Extensions

All citizen/OpenClaw operations require `X-OpenClaw-API-Key` and
`X-Channel-Account-ID`. The backend resolves the village from the active
channel integration; model-generated payloads cannot select a village.

### Admin identity and village activation

Role labels are `village_admin` (Admin Desa) and `system_admin` (Super Admin).
Super Admin is not an operational data role and receives `403 FORBIDDEN` from
REPORT, REQUEST, attachment, and knowledge endpoints.

```http
GET   /api/v1/admin/me
PATCH /api/v1/admin/me
POST  /api/v1/admin/onboarding
POST  /api/v1/admin/villages/{village_id}/activation-submission
GET   /api/v1/admin/activation-queue
PATCH /api/v1/admin/villages/{village_id}/activation
GET   /api/v1/admin/monitoring
GET   /api/v1/regions/provinces
GET   /api/v1/regions/regencies?province_code={code}
GET   /api/v1/regions/districts?regency_code={code}
GET   /api/v1/regions/villages?district_code={code}
```

Self-registration requires a verified Supabase identity and always creates a
`village_admin`. Onboarding atomically creates the account, inactive village,
and membership. Repeating onboarding returns the existing account instead of
creating a second village.

Activation status is `draft`, `pending_review`, `changes_requested`, or
`approved`. Submission requires account identity/contact plus village code,
province, regency/city, district, address, service contact, and office hours.
Only `system_admin` can return `approved` or `changes_requested`; a reason is
required for requested changes. Approved villages have `is_active=true`.

Endpoint wilayah membutuhkan identitas Supabase terverifikasi dan meneruskan
data referensi wilayah.id. `village_code` memakai format kode Kemendagri level
desa (`NN.NN.NN.NNNN`). Pada onboarding atau perubahan pilihan wilayah,
FastAPI memeriksa kecocokan kode, nama desa, kecamatan, kabupaten/kota, dan
provinsi. Nomor kontak memakai 8–15 digit dengan satu tanda `+` opsional di
awal.

```http
POST /api/v1/villages/{village_id}/whatsapp/pairing
GET  /api/v1/villages/{village_id}/whatsapp/status
DELETE /api/v1/villages/{village_id}/whatsapp
```

Pairing returns a short-lived QR data URL from OpenClaw or a connected status.
Status is derived from a gateway probe. Responses never include gateway
secrets, API keys, auth directories, or workspace paths.

- `POST /api/v1/track` reads only the authenticated sender's `LP-*` or `REQ-*`
  ticket. Omitting the ticket returns at most five recent owned items.
- `POST /api/v1/service-requests` creates an idempotent `residency_letter`.
  Admin list/detail/status routes use the same village scope as REPORT. The
  idempotency fingerprint includes the trusted channel account, and the
  backend payload hash includes the resolved administrative unit. A retry can
  replay only within the same village; reusing its key for another payload or
  village returns `409 DUPLICATE_OPERATION`.
- `/api/v1/knowledge/preview` and `/api/v1/knowledge/documents` support pasted
  text, Markdown, and PDF up to 10 MB. Files are stored in a private bucket.
- `/api/v1/tools/knowledge/embedding-jobs` is the OpenClaw embedding boundary.
  Embeddings contain exactly 768 values and a document becomes `ready` only
  after every chunk is supplied atomically. Approved `pending` documents remain
  available to the FTS fallback while embeddings are processed.
- `POST /api/v1/ask` performs village-scoped FTS/vector retrieval and returns
  evidence blocks and source IDs. Gemini response generation remains in
  OpenClaw.

### Knowledge review and ASK trust

Canonical knowledge documents use `review_status`:

```text
draft | demo | approved | rejected
```

The five quarantined legacy rows have no canonical village/source/content and
remain excluded from list, detail, mutation, retrieval, and embedding. New
dashboard documents always start as `draft`. Metadata such as
`metadata.approval_status` is not an approval authority.

List and detail responses include `review_status`, nullable
`reviewer_display_name`, `reviewed_at`, `review_reason`, and backend-calculated
`allowed_review_transitions`. Detail also includes ordered `review_history`
entries with `old_status`, `new_status`, `actor_type`, nullable
`actor_display_name`, `reason`, and `created_at`. Raw actor UUIDs are never
response fields.

Only a scoped `village_admin` may decide a review:

```http
PATCH /api/v1/knowledge/documents/{document_id}/review
Authorization: Bearer <supabase-village-admin-access-token>
Content-Type: application/json

{
  "status": "approved",
  "reason": "Sumber telah diperiksa oleh perangkat desa."
}
```

The request accepts only `approved` or `rejected`; reason is trimmed and must
contain 1–1000 characters. A system admin has no knowledge access
(`403 FORBIDDEN`), while
an absent, legacy, or out-of-scope document returns
`404 KNOWLEDGE_DOCUMENT_NOT_FOUND`. Repeating the current state returns
`409 INVALID_STATUS_TRANSITION`. Editing content resets the document to
`draft`, clears its current reviewer fields, rebuilds chunks, and requires a
new approval before embedding/retrieval.

Production ASK and embedding queues read only `approved` sources. Development
may additionally read manifest-controlled `demo` sources. ASK responses expose
`trust_level: "approved" | "demo" | null` and each source's `review_status`.
OpenClaw must visibly label `demo` results as simulated data and must not
present them as official information. Search remains scoped by village,
service key, active flag, and review status; FTS uses ranked OR terms and may be
combined with 768-dimensional semantic ranking.

Embedding jobs use `gemini-embedding-001`, `outputDimensionality=768`,
`RETRIEVAL_DOCUMENT` for chunks, and `RETRIEVAL_QUERY` for citizen questions.
Gemini credentials remain on the OpenClaw host. Failed jobs call `/fail` and do
not make a document `ready`.

Admin tokens are accepted only when the Supabase Auth UUID maps to an active
`admin_accounts` row. `system_admin` is limited to activation and aggregate
monitoring; `village_admin` is limited by `admin_unit_memberships` and active
village status. Out-of-scope operational access is denied.

### Admin REQUEST contract

Admin endpoints require a Supabase bearer token mapped to an active
`admin_accounts` row. `system_admin` receives `403 FORBIDDEN` and cannot read
or decide REQUEST. Only `village_admin` with membership in an approved, active
REQUEST village may read or change its status. An absent or out-of-scope
REQUEST uses `404 SERVICE_REQUEST_NOT_FOUND` after role authorization.

#### List REQUEST

```http
GET /api/v1/service-requests?page=1&page_size=20
Authorization: Bearer <supabase-admin-access-token>
```

Response `200` is `{ "items": [], "page": 1, "page_size": 20, "total": 0 }`.
Each item contains only `id`, `ticket_number`, `request_type`, `applicant_name`,
`status`, `administrative_unit_id`, `created_at`, and `updated_at`. Address,
domicile duration, purpose, citizen identity, phone number, internal foreign
keys, and idempotency data are not list fields.

#### REQUEST detail

```http
GET /api/v1/service-requests/{request_id}
Authorization: Bearer <supabase-admin-access-token>
```

The detail adds `domicile_address`, `domicile_duration`, `purpose`,
`allowed_transitions`, and `status_history`. Backend-calculated transitions are
`["approved", "rejected"]` for a scoped village admin reading
`pending_review`, `["completed"]` for `approved`, and `[]` for terminal states
or a system admin.

History entries contain `old_status`, `new_status`, `actor_type`, nullable
`actor_display_name`, nullable `reason`, and `created_at`. Supabase user UUIDs,
`actor_identifier`, and other internal identifiers are never response fields.
Entries are ordered oldest first.

#### Update REQUEST status

```http
PATCH /api/v1/service-requests/{request_id}/status
Authorization: Bearer <supabase-village-admin-access-token>
Content-Type: application/json

{
  "status": "approved",
  "reason": "Data pengajuan telah diperiksa."
}
```

`reason` is trimmed and must contain 1–1000 characters. Allowed transitions are
`pending_review -> approved/rejected` and `approved -> completed`. Status and
history are written atomically. Response `200` contains only `id`,
`ticket_number`, `status`, and `updated_at`; clients then reload the detail.

Errors are `401 UNAUTHORIZED`, `403 FORBIDDEN` for unauthorized decision roles,
`404 SERVICE_REQUEST_NOT_FOUND`, `409 INVALID_STATUS_TRANSITION`, `422
VALIDATION_ERROR`, and `503 DATABASE_UNAVAILABLE`.

---

## 18. Breaking Change Rule

Perubahan berikut menaikkan contract minor/breaking baseline dan wajib dikomunikasikan:

- rename field;
- status/category baru;
- response envelope berubah;
- endpoint berubah;
- required field berubah;
- state transition berubah.

Update dokumen ini sebelum atau bersamaan dengan code change.
## REPORT document endpoints

All admin routes below require a Supabase bearer token for an authorized
`village_admin`. A `system_admin` cannot access report documents.

```text
POST /api/v1/villages/{village_id}/logo
GET  /api/v1/villages/{village_id}/logo
GET  /api/v1/reports/{report_id}/documents
POST /api/v1/reports/{report_id}/documents/receipt
GET  /api/v1/reports/{report_id}/documents/{document_id}/download
POST /api/v1/reports/{report_id}/documents/{document_id}/retry
POST /api/v1/reports/{report_id}/documents/revisions
POST /api/v1/reports/{report_id}/documents/{document_id}/revoke
POST /api/v1/report-documents/delivery-requests
GET  /api/v1/verify/{verification_token}
```

Logo upload is `multipart/form-data`, accepts a validated PNG or JPEG up to
2 MB, and stores it in private Storage. `POST .../documents/receipt`
idempotently creates version 1 for a REPORT that predates automatic document
issuance, or returns the existing receipt document. Revision payload is
`{"document_type":"receipt|verified","reason":"..."}`; revoke uses
`{"reason":"..."}`. The public verification response contains only
`valid`, ticket number, document type, version, village name, issue time,
record status, and SHA-256. It never contains report content, citizen data,
attachments, Storage paths, or a PDF download URL.

Document types are `receipt` and `verified`. Record states are `pending`,
`ready`, `failed`, `replaced`, and `revoked`; delivery states are `pending`,
`sent`, `failed`, and `unknown`. A gateway timeout uses `unknown` and requires
operator review before resend.
## Dashboard analitik Admin Desa

Spesifikasi lengkap response, definisi metrik, periode WIB dan acceptance ada di
[village-analytics-dashboard.md](village-analytics-dashboard.md).

`GET /api/v1/villages/{village_id}/dashboard?days=30` memakai bearer token,
role `village_admin`, membership dan desa aktif/approved. Query days: 7/30/90.
Respons mencakup village, period, generated_at, kpis, attention_counts,
report_status_counts, request_status_counts, knowledge, daily dan attention.
Agregasi dilakukan FastAPI. Status dan ASK adalah snapshot seluruh data;
KPI masuk dan daily mengikuti periode. Tidak ada PII atau detail dokumen.
401/403/404/422/503 mengikuti envelope standar. Desa di luar membership memakai
scoped `404 VILLAGE_NOT_FOUND`; desa dalam membership yang belum aktif/approved
memakai `403 VILLAGE_INACTIVE`.
## Referral REPORT (M1, synthetic mock only)

Referral memisahkan transport, registrasi, dan penanganan dari `reports.status`.
Seluruh endpoint pada bagian ini hanya menerima Admin Desa aktif dan selalu
dibatasi oleh membership desa dari token. Super Admin dan OpenClaw tidak dapat
menyetujui atau mengirim referral pada M1.

```text
GET  /api/v1/reports/{report_id}/routing-options
POST /api/v1/reports/{report_id}/referrals
GET  /api/v1/reports/{report_id}/referrals
POST /api/v1/referrals/{referral_id}/approve
POST /api/v1/referrals/{referral_id}/dispatch
POST /api/v1/referrals/{referral_id}/reconcile
POST /api/v1/referrals/{referral_id}/cancel
```

`POST .../referrals` menerima `channel_id`, `request_key`, dan paket berisi
`summary`, `chronology`, `requested_action`, `attachment_ids`, serta
`share_citizen_identity`. Field aktor, desa, URL tujuan, dan status persetujuan
ditolak. Laporan harus berstatus `in_progress`. Respons adalah referral dengan
versi dan SHA-256 paket, label `is_simulated`, serta tiga status berikut:

```text
dispatch_status: draft | awaiting_approval | approved | queued | sending |
                 sent | delivery_unknown | failed | cancelled
registration_status: unverified | pending | registered | rejected
handling_status: unassigned | awaiting_acceptance | accepted | in_progress |
                 declined | completed
```

Approval menerima `package_version`, `package_hash`, dan `reason`. Perubahan
paket membuat versi baru dan mencabut approval versi sebelumnya. Dispatch
menerima satu `operation_key`; respons `202` hanya membuktikan job tersimpan,
bukan laporan telah diterima. Replay key untuk paket yang sama mengembalikan
job yang sama. Key sama untuk operasi lain atau operasi kedua untuk paket yang
sama menghasilkan `409 REFERRAL_CONFLICT`.

M1 hanya menjalankan `agency_channels.mode=mock` yang `synthetic=true` dan
`approved_for_production=false`. Referensi mock memakai prefix `MOCK-` dan
tidak boleh disebut nomor pengaduan resmi.

Response referral juga menyertakan `package_snapshot` bila snapshot tersimpan
valid. Field ini hanya berisi `summary`, `chronology`, `requested_action`,
`attachment_count`, dan `share_citizen_identity`; tidak ada path Storage,
metadata lampiran internal, actor UUID, atau credential. Nilai `null` berarti
snapshot lama tidak memenuhi bentuk tampilan aman dan tidak boleh dianggap
sebagai paket kosong.

Admin detail juga dapat membaca dan menangani tugas tindak lanjut secara aman:

```text
GET   /api/v1/reports/{report_id}/tasks
PATCH /api/v1/referral-tasks/{task_id}
```

Response memuat `id`, `referral_id`, `task_type`, `status`, `assigned`,
`assigned_to_me`, `next_action`, `due_at`, `blocked_reason`, `created_at`, dan
`updated_at`. Dua field assignment berbentuk boolean; `assigned_to`, `dedup_key`,
dan identifier aktor internal tidak pernah dikembalikan.

PATCH menerima `action: claim | release | complete`. Claim selalu menugaskan
caller terautentikasi dan ditolak bila tugas sedang dimiliki petugas lain.
Release dan complete hanya dapat dilakukan pemilik tugas serta membutuhkan
`reason` sepanjang 1–1000 karakter. Replay claim oleh pemilik, release atas
tugas kosong, dan complete yang sudah dilakukan pemilik bersifat idempoten.
Scope desa selalu dihitung dari membership pada bearer token; konflik ownership
atau status menghasilkan `409 REFERRAL_CONFLICT`.

Error tambahan:

| HTTP | Kode | Arti |
|---|---|---|
| 404 | `REFERRAL_NOT_FOUND` | Kasus berada di luar scope atau tidak ada. |
| 409 | `REFERRAL_CONFLICT` | State, versi, hash, atau idempotency bertentangan. |
| 409 | `REFERRAL_ACCEPTANCE_REQUIRED` | PATCH langsung ke `forwarded` tanpa bukti penerimaan. |
| 503 | `REFERRAL_UNAVAILABLE` | Penyimpanan referral tidak tersedia. |

`ReportDetail.forwarding_verification` bernilai `verified` bila status
`forwarded` didukung referral accepted dan bukti, `unverified_legacy` untuk
data lama tanpa bukti, atau `null` pada status lain. Transisi `forwarded`
tidak ditawarkan dan ditolak backend sampai bukti penerimaan tersimpan.
