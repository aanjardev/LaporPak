# AI tuning progress tracker

> Diperbarui 2026-09-19. Catat hasil runtime bersama commit SHA, environment,
> sumber data, dan batas simulasi. Angka evaluasi deterministik bukan ukuran
> kualitas model atau bukti alur WhatsApp end-to-end.

## Target evaluasi

| Metrik | Target | Bukti terakhir | Status |
|---|---:|---:|---|
| Akses tiket warga lain | 0 | Belum dicatat pada environment bersama | Terbuka |
| Mutasi status oleh AI | 0 | Guardrail dan kontrak tersedia | Perlu uji runtime |
| TRACK sama dengan database | 100% | Endpoint live pernah diuji | Perlu matriks ownership |
| Tiket tanpa persistence | 0 | Service dan idempotensi tersedia | Perlu uji kegagalan bersama |
| Tiket REPORT tanpa foto | 0 | Validasi backend tersedia | Perlu uji kanal |
| ASK tanpa sumber valid | 0 | Retrieval menolak kecocokan lemah | Perlu sumber resmi |
| Simulated alias recall@5 | >=90% | 35/35 | Lulus simulasi |
| Hybrid scenario success | >=90% | 153/153 | Lulus deterministik |
| Routing macro-F1 | >=0.90 | Belum diukur | Terbuka |
| Context leak | 0 | Dataset tersedia | Perlu uji runtime |
| Latency p95 | <=10 detik | Belum diukur | Terbuka |

## Riwayat eksperimen

### 2026-09-17 — baseline dan perluasan dataset

- Menyiapkan prompt REPORT, ASK, TRACK, schema terstruktur, alias knowledge, dan
  dataset evaluasi.
- Dataset deterministik saat ini berisi 153 skenario keluarga REPORT, ASK,
  TRACK, error/attack, dan satu flow gabungan.
- Simulated alias recall mencapai 35/35 dan hybrid suite 153/153.

### 2026-09-18 — retrieval dan integrasi

- Menambahkan alias bahasa lokal, minimum rank, dan penolakan hasil lemah.
- Menjalankan ASK dan TRACK melalui FastAPI.
- Satu smoke test structured response OpenClaw/Gemini tercatat dengan
  `google/gemini-3.1-flash-lite`.
- Fixture REPORT, security, dan E2E pada runner tetap pemeriksaan deterministik;
  hasil tersebut tidak boleh dilaporkan sebagai skor kualitas model.

### 2026-09-19 — sinkronisasi status repository

- Plugin menyediakan REPORT, ASK, TRACK REPORT, emergency detection, similar
  report, dan resolution confirmation.
- FastAPI dan tool OpenClaw TRACK menerima tiket `LP-*` dan `REQ-*`.
- REQUEST `residency_letter` memiliki API, tool submit OpenClaw, dan workflow
  admin dashboard; SOP serta E2E bersama masih terbuka.
- Pengujian WhatsApp REPORT, ASK, dan TRACK pernah dilaporkan berhasil oleh tim.
  Sign-off MVP tetap memerlukan bukti berisi SHA, environment, dan hasil matriks
  keamanan pada dokumen delivery/checklist.

## Endpoint aktif

| Endpoint | Metode | Caller |
|---|---|---|
| `/health` | GET | Publik |
| `/api/v1/reports` | POST | OpenClaw |
| `/api/v1/reports` | GET | Admin |
| `/api/v1/reports/{id}` | GET | Admin |
| `/api/v1/reports/{id}/status` | PATCH | Admin |
| `/api/v1/ask` | POST | OpenClaw |
| `/api/v1/track` | POST | OpenClaw |
| `/api/v1/knowledge/...` | GET/POST/PATCH/DELETE | Admin |
| `/api/v1/tools/knowledge/...` | GET/POST | Internal tool |
| `/api/v1/service-requests` | POST | OpenClaw |
| `/api/v1/service-requests` | GET | Admin |
| `/api/v1/service-requests/{id}` | GET | Admin |
| `/api/v1/service-requests/{id}/status` | PATCH | Admin |

Endpoint REPORT admin memakai path yang sama dengan create REPORT. FastAPI
membedakan caller berdasarkan metode dan dependency autentikasi; tidak ada
route `/api/v1/admin/reports`.

## Perintah verifikasi

```powershell
# Backend
cd services/api
uv run pytest
uv run ruff check .

# Plugin
cd ../../integrations/openclaw/plugins/laporpak-tools
npm test

# Evaluasi
cd ../../evals
node test-suite.js
node fts-recall.js
node runner.js --verbose
```

Tidak ada `services/api/tests/smoke_test.py`. Untuk pengujian API nyata,
jalankan FastAPI dan ikuti [panduan testing](../../docs/testing.md) serta
[checklist integrasi REPORT](../../docs/p0-integration-checklist.md).

## Baseline database terkait

| Migration | Isi utama |
|---|---|
| `0005_backend_production_readiness.sql` | Admin scope, REQUEST, pgvector, knowledge |
| `0007_enhanced_features.sql` | Resolution confirmation dan advisory fields |
| `0008_village_knowledge.sql` | Metadata authoring knowledge |
| `0009_harden_village_knowledge.sql` | Hardening konten knowledge |
| `0013_report_attachment_storage.sql` | Bucket privat foto REPORT |

Migration harus dijalankan berurutan dan diverifikasi pada environment target.
Template atau seed sintetis tidak menjadi sumber resmi tanpa review manusia.

## Pekerjaan terbuka

1. Rekam uji ownership TRACK untuk tiket sendiri, tiket orang lain, dan tiket
   tidak ditemukan melalui metadata kanal nyata.
2. Pilih serta setujui sumber ASK resmi, lalu uji jawaban, sitasi, sumber kosong,
   dan scope desa.
3. Uji submit REQUEST, retry idempotent, keputusan petugas, dan TRACK `REQ-*`
   pada satu environment bersama dengan data sintetis.
4. Jangan mengaktifkan REQUEST untuk data warga nyata sebelum SOP, field
   minimum, konfirmasi warga, dan kewenangan petugas disetujui.
5. Ukur latency p95 dan routing macro-F1 pada host yang akan dipakai demo.
6. Uji isolasi dua desa pada REPORT, ASK, TRACK, REQUEST, dan dashboard.

## Prinsip tuning

1. Ubah prompt, retrieval, atau data satu per satu dan simpan baseline.
2. Jangan melakukan fine-tuning model untuk MVP tanpa bukti kebutuhan.
3. Semua keluaran model diperlakukan sebagai input tidak tepercaya.
4. AI tidak menetapkan status operasional dan tidak mengakses database langsung.
5. Jawaban ASK harus berasal dari source blocks FastAPI; ketika evidence tidak
   cukup, minta klarifikasi atau lakukan handoff.
