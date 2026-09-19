# LaporPak — API & Data Contract

> **Contract version:** `0.2.0`  
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
| 409 | `INVALID_STATUS_TRANSITION` |
| 409 | `DUPLICATE_OPERATION` |
| 422 | `VALIDATION_ERROR` |
| 503 | `DATABASE_UNAVAILABLE` |
| 503 | `AI_UNAVAILABLE` |
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
dibatasi oleh `admin_unit_memberships`. Pendaftaran admin publik tidak tersedia.
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
    "id": "5c242fc6-77a8-4fa7-a12f-a67bbc75839b",
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
  "attachments": [],
  "status_history": [
    {
      "old_status": null,
      "new_status": "pending_verification",
      "actor_type": "system",
      "actor_identifier": null,
      "notes": "Report created",
      "created_at": "2026-09-16T14:00:00Z"
    }
  ],
  "verified_at": null,
  "resolved_at": null,
  "created_at": "2026-09-16T14:00:00Z",
  "updated_at": "2026-09-16T14:00:00Z"
}
```

`responsible_unit` bernilai `null` bila belum ditetapkan. Jika tersedia,
backend mengirim objek `{ "id": "<uuid>", "name": "<nama unit>" }`.

Jika tidak ada:

```http
404 REPORT_NOT_FOUND
```

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

---

## 17. Production Backend Extensions

All citizen/OpenClaw operations require `X-OpenClaw-API-Key` and
`X-Channel-Account-ID`. The backend resolves the village from the active
channel integration; model-generated payloads cannot select a village.

- `POST /api/v1/track` reads only the authenticated sender's `LP-*` or `REQ-*`
  ticket. Omitting the ticket returns at most five recent owned items.
- `POST /api/v1/service-requests` creates an idempotent `residency_letter`.
  Admin list/detail/status routes use the same village scope as REPORT.
- `/api/v1/knowledge/preview` and `/api/v1/knowledge/documents` support pasted
  text, Markdown, and PDF up to 10 MB. Files are stored in a private bucket.
- `/api/v1/tools/knowledge/embedding-jobs` is the OpenClaw embedding boundary.
  Embeddings contain exactly 768 values and a document becomes `ready` only
  after every chunk is supplied atomically. Approved `pending` documents remain
  available to the FTS fallback while embeddings are processed.
- `POST /api/v1/ask` performs village-scoped FTS/vector retrieval and returns
  evidence blocks and source IDs. Gemini response generation remains in
  OpenClaw.

Admin tokens are accepted only when the Supabase Auth UUID maps to an active
`admin_accounts` row. `system_admin` is global; `village_admin` is limited by
`admin_unit_memberships`. Out-of-scope detail/mutation returns `404`.

### Usulan kontrak admin REQUEST untuk ditinjau Anjar (belum disahkan)

Kode backend saat ini menyediakan `residency_letter` melalui endpoint berikut.
Bagian ini mencatat bentuk yang teramati untuk fixture frontend; **bukan**
persetujuan SOP layanan, izin menampilkan data warga nyata, atau izin melakukan
keputusan nyata dari dashboard.

- `GET /api/v1/service-requests?page=1&page_size=20` mengembalikan
  `{ items, page, page_size, total }`; `page >= 1`, `1 <= page_size <= 100`.
- `GET /api/v1/service-requests/{request_id}` mengembalikan satu item atau
  `404 NOT_FOUND`, termasuk bila pengajuan di luar cakupan desa admin.
- `PATCH /api/v1/service-requests/{request_id}/status` menerima
  `{ "status": "approved" | "rejected" | "completed", "reason": "..." }`
  dan mengembalikan item terbaru; alasan wajib dengan panjang 1–1000 karakter.
  Backend saat ini menerima `pending_review → approved/rejected` dan
  `approved → completed`; transisi lain menghasilkan `409 INVALID_STATUS_TRANSITION`.

Item saat ini berisi `id` (UUID), `ticket_number`, `request_type`
(`residency_letter`), `applicant_name`, `domicile_address`,
`domicile_duration`, `purpose`, `status` (`pending_review`, `approved`,
`rejected`, `completed`), `administrative_unit_id` (UUID), `created_at`, dan
`updated_at`. GET/PATCH admin memerlukan bearer token Supabase dan pemeriksaan
akun aktif serta cakupan desa pada FastAPI. Kegagalan layanan memakai `503
DATABASE_UNAVAILABLE`; input tidak valid memakai `422 VALIDATION_ERROR`.

**Keputusan terbuka bersama pemilik SOP, Ferdi, Anjar, dan Farel:** dokumen SOP
Surat Keterangan Domisili yang disetujui; field minimum yang boleh dikumpulkan
dan ditampilkan; jabatan/peran yang berwenang memutuskan; kapan pengajuan resmi;
serta bentuk riwayat status/aktor/alasan yang aman pada respons detail. Backend
menyimpan riwayat, tetapi respons detail saat ini belum menyertakannya.
Frontend belum boleh mengaktifkan pembacaan atau PATCH REQUEST nyata sebelum
keputusan tersebut ditinjau dan kontrak difinalkan.

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
