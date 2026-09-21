# Bukti implementasi referral M0-M1

Tanggal pemeriksaan: 21 September 2026  
Base repository: `380b10028a50fcbd8e29f4c23d86fc95cafa3e77`  
Branch kandidat: `feat/report-referral-m1`  
Mode kanal: mock sintetis; tidak ada request jaringan. Migration dan seed M1
diterapkan ke Supabase development aktif atas instruksi pemilik proyek.

## Hasil yang dibuktikan lokal

- Kontrak, migration `0017`, pemetaan SQLAlchemy, service, route, worker,
  fixture dua desa, dan connector mock tersedia dalam satu modular monolith.
- Approval terikat pada versi dan SHA-256 paket. Revisi mencabut approval lama.
- Dispatch memakai operation key dan outbox persisten. Dua operasi untuk paket
  yang sama ditolak; replay operation key yang sama memakai job yang sama.
- Scope desa berasal dari caller backend. Payload tidak menerima desa, aktor,
  status approved, atau URL tujuan.
- Timeout-after-accept menulis ledger mock dahulu, lalu masuk
  `delivery_unknown`. Rekonsiliasi melakukan lookup dan tidak mengirim ulang.
- Lease worker yang kedaluwarsa diarahkan ke lookup rekonsiliasi. Kanal yang
  dinonaktifkan, approval dicabut, atau versi berubah diblokir sebelum submit.
- `reports.status=forwarded` hanya diizinkan bila referral mempunyai handling
  accepted dan evidence. Data forwarded lama diberi `unverified_legacy`.

## Perintah dan hasil

| Direktori | Perintah | Hasil |
|---|---|---|
| `services/api` | `.venv/Scripts/python.exe -m pytest` | 193 passed, 2 warning dependency |
| `services/api` | `.venv/Scripts/python.exe -m ruff check .` | passed |
| `services/api` | `.venv/Scripts/python.exe -m app.db.migrate apply` | migration `0017` applied |
| `services/api` | checker integrasi PostgreSQL sementara | dua desa, dua worker, timeout, restart, dan rekonsiliasi passed; fixture laporan dibersihkan |
| `apps/dashboard` | lima script test dashboard | 32 passed |
| `apps/dashboard` | `npm run lint` | passed |
| `apps/dashboard` | `npm run build` | passed |
| `integrations/openclaw/plugins/laporpak-tools` | `npm test` | 12 passed |

## Matriks M1 yang relevan

| ID | Status | Bukti dan batas |
|---|---|---|
| T01 | passed | Draft, approval, dispatch, receipt, dan proyeksi status dijalankan pada PostgreSQL development. |
| T02 | passed | Tes service menolak scope Desa B untuk kasus Desa A. |
| T03 | passed | Tidak ada endpoint referral warga; regresi ownership TRACK tetap lulus. |
| T04 | passed | API menolak `tenant_id`, aktor, approved flag, dan field ekstra. |
| T08 | passed | Dispatch tanpa approval ditolak dan tidak membuat job. |
| T09 | passed | Revisi menaikkan versi, mencabut approval, dan menolak approval lama. |
| T10 | passed | Worker memeriksa approval revoked dan versi aktif sebelum submit. |
| T11 | passed | Dua worker konkuren memproses dua job; replay operation key tidak membuat job atau receipt tambahan. |
| T12 | passed | Timeout-after-accept dan lookup ledger yang sama lulus pada test connector. |
| T13 | passed | Worker proses baru merekonsiliasi receipt persisten setelah timeout tanpa submit ulang. |
| T14 | passed | Kanal tanpa lookup mempertahankan hasil ambigu. |
| T15 | passed | Transport-only tidak menjadi registered, accepted, atau forwarded. |
| T16 | not_run | Callback belum ada pada M1. |
| T20 | partial | Tugas rekonsiliasi dipersistenkan dan diselesaikan pada PostgreSQL; exhaustion retry sementara tetap dibuktikan pada unit test deterministik. |
| T21 | passed | PATCH langsung ke forwarded ditolak tanpa accepted evidence. |
| T22 | passed | Forwarded lama ditandai `unverified_legacy` tanpa membuat bukti. |
| T26 | passed | Pembatalan job pending dan kill switch kanal diuji. |
| T30 | passed | Worker menolak kanal live dan mock yang ditandai production-approved. |

## Hasil database development dan tugas berikutnya

- Ledger mencatat migration `0017`; migration `0001`-`0017` berstatus applied.
- Seed `0005` menyediakan dua desa dan dua kanal mock yang eksplisit sintetis,
  tidak disetujui untuk produksi, dan tidak melakukan request jaringan.
- Checker memakai dua laporan/warga sementara lalu membersihkannya. Unit dan
  kanal mock dipertahankan agar skenario development dapat diulang.
- M1 telah memenuhi prasyarat persistensi untuk melanjutkan M2. M2 tetap hanya
  boleh menambahkan tool OpenClaw terbatas dan tidak boleh menyediakan tool
  approval atau mengaktifkan kanal live.
