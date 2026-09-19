# Checklist integrasi P0 REPORT

> Status: daftar kerja tim per 2026-09-18. Checklist yang belum dicentang berarti
> perlu diverifikasi dalam putaran integrasi berikutnya, bukan berarti fiturnya
> belum dibuat. Gunakan data dan akun uji; jangan tulis secret, token, nomor
> WhatsApp pribadi, atau isi laporan warga nyata di dokumen ini.

## Pembaruan terverifikasi 2026-09-19

- [x] Schema, constraint, index, RLS, extension, seed akses, dan bucket private
  development diaudit read-only; konfigurasi bucket `report-attachments`
  diperbaiki sesuai migration `0013`.
- [x] Lima dokumen `DATA UJI` Desa Sukamaju diimpor idempotent; eksekusi ulang
  menghasilkan `Imported: 0; skipped: 5`.
- [x] ASK FTS nyata melalui FastAPI dan Supabase menghasilkan `200 answered`
  dengan source document/chunk; retrieval kini hanya menerima
  `approval_status=approved` secara eksplisit.
- [x] Unit/contract test membuktikan query admin REQUEST membawa filter unit
  desa dan detail di luar scope diperlakukan tidak ditemukan.
- [ ] REQUEST belum dibuktikan melalui WhatsApp/OpenClaw host nyata dan dua
  desa belum dibuat pada environment bersama; test otomatis tidak menggantikan
  gerbang integrasi tersebut.
- [ ] Endpoint foto privat belum diuji dengan object Supabase Storage nyata.

Dokumen ini mengatur pelaksanaan dan bukti uji. Kebutuhan P0 ada di
[project-context.md](project-context.md), bentuk data dan respons di
[api-contract.md](api-contract.md), alur dan fallback di
[workflows.md](workflows.md), serta hasil uji sebelumnya di
[p0-verification-evidence.md](p0-verification-evidence.md). Perubahan kontrak
harus dibuat di dokumen sumber tersebut, bukan di checklist ini.

## Titik awal

- Alur WhatsApp/OpenClaw sampai verifikasi petugas di dashboard pernah berhasil
  pada 2026-09-17; lihat bukti uji sebelumnya. Ulangi setelah perubahan lintas
  komponen atau konfigurasi.
- Demo P0 memakai satu desa dan akun Supabase Auth yang diundang. Sebelum data
  nyata dibuka ke publik, FastAPI harus memeriksa akun admin aktif, peran, dan
  cakupan desa pada setiap GET/PATCH. Validasi token saja belum memenuhi gerbang
  publik ini.
- Konfigurasi percakapan dan kanal OpenClaw berada di host AI. Keberhasilan tes
  plugin di repository tidak membuktikan kanal dan model sedang aktif.

## Persiapan bersama

- [ ] Semua role memakai commit `main` yang sama; catat SHA pada bukti uji.
- [ ] Ferdi, Anjar, dan Farel menyepakati satu lingkungan uji: alamat dashboard,
  API, Supabase, OpenClaw, serta akun dan nomor WhatsApp khusus uji.
- [ ] FastAPI `/health`, koneksi database, kanal WhatsApp, dan Gateway OpenClaw
  dapat diakses dari tempat pengujian. Simpan nilai rahasia hanya di environment
  masing-masing komponen.
- [ ] Gunakan fixture/laporan uji baru agar status awal dan jumlah riwayat dapat
  diperiksa tanpa bergantung pada laporan lama.

## Tugas per role

### Ferdi — frontend (`apps/dashboard/`)

- [ ] Aktifkan `REPORTS_DATA_SOURCE=api` secara lokal. Masuk dengan akun undangan;
  pastikan daftar, pencarian, filter, pagination, dan detail memakai data API.
- [ ] Verifikasi dan tolak dua laporan uji yang berbeda dengan alasan. Setelah
  reload, cocokkan status, waktu, dan riwayat yang tampil dengan respons API.
- [ ] Periksa logout, akses tanpa sesi, serta respons GET/PATCH `401`, `403`,
  `404`, `409`, dan kegagalan layanan pada UI. Catat mana yang diuji dengan API
  nyata dan mana yang baru diuji memakai server simulasi.
- [ ] Periksa daftar, detail, formulir, serta pesan gagal pada layar ponsel dan
  desktop. Jangan menaruh credential backend atau akses tabel Supabase di UI.

Pemeriksaan parsial 2026-09-18 ada di
[p0-verification-evidence.md](p0-verification-evidence.md#frontend-integration-recheck--2026-09-18):
dashboard terhubung ke dua laporan FastAPI nyata, sedangkan halaman kedua dan
respons gagal sudah disiapkan serta diuji pada API simulasi. Semua kotak di atas
tetap terbuka sampai pemeriksaan UI dan keputusan pada laporan
`pending_verification` benar-benar selesai.

### Anjar — backend dan database (`services/api/`, `database/`)

- [ ] Pastikan migration/seed yang diperlukan telah diterapkan di lingkungan
  uji; jalankan tes API dan Ruff pada commit yang dipakai bersama.
- [ ] Periksa POST dari tool OpenClaw: hanya caller berizin yang dapat membuat
  laporan, identitas warga berasal dari metadata kanal, data wajib divalidasi,
  dan tiket baru dikembalikan setelah persistence berhasil.
- [ ] Buktikan retry dengan satu `Idempotency-Key` menghasilkan satu tiket;
  payload berbeda dengan key sama ditolak. Buktikan status dan riwayat tetap
  konsisten saat PATCH gagal atau transisi ditolak.
- [ ] Sebelum deployment publik, hubungkan identitas Supabase ke akun admin
  aktif, peran, dan cakupan desa. Terapkan pembatasan pada daftar, detail, dan
  PATCH; ID di luar cakupan menghasilkan `404` tanpa membocorkan laporan.

### Farel — AI dan OpenClaw (`integrations/openclaw/`, host OpenClaw)

- [ ] Periksa koneksi WhatsApp, pemanggilan Gemini, versi prompt/schema/model,
  dan allowlist tool pada host yang dipakai untuk uji.
- [ ] Uji `REPORT`, kebutuhan klarifikasi, konfirmasi warga, dan `UNKNOWN` dari
  pesan WhatsApp. Tool create hanya dipanggil setelah konfirmasi dan tidak
  dipanggil untuk `UNKNOWN` atau output AI yang tidak valid.
- [ ] Pertahankan satu UUID draf laporan selama klarifikasi, konfirmasi, dan
  retry. Uji jawaban konfirmasi berulang; warga harus menerima tiket yang sama.
- [ ] Uji kegagalan Gemini/API. Jangan mengklaim tiket terbit sebelum respons
  sukses dari FastAPI. Jalankan ulang dataset evaluasi jika prompt/model berubah.

## Skenario bersama dan bukti

Catat hasil setiap skenario di [p0-verification-evidence.md](p0-verification-evidence.md)
dengan tanggal, commit SHA, lingkungan uji, hasil yang diamati, dan pemilik
perbaikan bila gagal. Gunakan nomor tiket uji dan bukti yang sudah disamarkan.

| Skenario | Hasil yang harus terlihat | Pemilik uji | Status |
|---|---|---|---|
| Laporan lengkap dari WhatsApp | Satu tiket tersimpan, muncul di daftar/detail, dan dapat diverifikasi; status serta riwayat bertahan setelah reload | Farel, Anjar, Ferdi | [ ] |
| Lokasi atau data wajib belum lengkap | OpenClaw meminta klarifikasi; FastAPI menolak payload belum lengkap; tidak ada tiket palsu | Farel, Anjar | [ ] |
| Pesan di luar REPORT atau output AI tidak valid | Tidak ada pemanggilan tool create dan tidak ada laporan baru | Farel, Anjar | [ ] |
| Konfirmasi atau event terkirim ulang | Satu draf menghasilkan satu tiket; retry mengembalikan tiket yang sama | Farel, Anjar | [ ] |
| Verifikasi dan penolakan petugas | Dua keputusan pada laporan berbeda tersimpan dengan alasan dan riwayat resmi | Ferdi, Anjar | [ ] |
| Sesi tidak ada atau token ditolak | GET/PATCH ditolak `401`; dashboard meminta login ulang | Ferdi, Anjar | [ ] |
| Admin tidak berizin atau laporan di luar cakupan | API memberi `403` atau `404` sesuai kontrak; dashboard tidak menampilkan data terlarang | Anjar, Ferdi | [ ] |
| Transisi status tidak sah | API memberi `409`; status dan riwayat resmi tidak berubah; UI meminta reload | Anjar, Ferdi | [ ] |
| Gemini, API, atau database gagal | Tidak ada klaim tiket/status berhasil tanpa persistence; pengguna menerima pesan gagal yang jelas | Farel, Anjar, Ferdi | [ ] |

## Kriteria selesai

- **Demo P0:** skenario alur utama dan fallback yang relevan di atas lulus pada
  lingkungan uji bersama, tanpa field mismatch atau secret di Git/log/bukti.
- **Deployment publik:** selain demo P0, pembatasan akun admin aktif, peran,
  dan cakupan desa sudah diterapkan serta diuji pada GET/PATCH nyata. Persyaratan
  ini tidak diganti oleh proteksi halaman Next.js.
- Setiap kegagalan dicatat dengan pemilik, langkah reproduksi singkat, dan
  hasil uji ulang. Perbarui bukti lama yang masih menyebut alur kanal sebagai
  pekerjaan mendatang ketika hasil terbaru sudah memastikan statusnya.
