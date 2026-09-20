# Rencana pemisahan Admin Desa dan Super Admin

Dokumen ini menjadi acuan implementasi akun, onboarding desa, pengaturan
mandiri, dan monitoring lintas desa. Kontrak rinci tetap berada di
`docs/api-contract.md`, batas komponen di `docs/architecture.md`, dan alur di
`docs/workflows.md`.

## Peran

- `village_admin` (**Admin Desa**) mengelola profil, WhatsApp, personalisasi
  AI, knowledge, REPORT, dan REQUEST hanya untuk desa pada membership-nya.
- `system_admin` (**Super Admin**) menyetujui aktivasi desa dan membaca metrik
  agregat. Role ini tidak dapat membaca detail warga atau membuat keputusan
  REPORT/REQUEST.
- Akun Super Admin hanya dibuat melalui provisioning server. Pendaftaran
  mandiri selalu menghasilkan Admin Desa.

## Aktivasi desa

Status aktivasi canonical adalah `draft`, `pending_review`,
`changes_requested`, dan `approved`. Desa lama dimigrasikan sebagai
`approved`. Desa baru tetap nonaktif sampai Super Admin menyetujui profil
lengkap. Keputusan dan alasannya dicatat pada riwayat aktivasi.

## Antarmuka

- Admin Desa memakai `/reports` dan pengaturan terpadu `/reports/settings`.
- Super Admin memakai dashboard `/admin`, antrean `/admin/activations`, daftar
  monitoring `/admin/villages`, dan detail agregat `/admin/villages/{id}`.
- Pengaturan WhatsApp membaca status gateway OpenClaw dan memakai QR pairing;
  penyimpanan konfigurasi saja tidak berarti terhubung.
- Respons browser tidak memuat secret, token, path workspace, atau kredensial
  gateway.
- Permintaan QR memakai ulang provisioning kanal yang sudah ada, menampilkan
  state loading/error yang terbatas waktu, dan memulihkan sekali sesi yang
  kedaluwarsa sebelum meminta pengguna login kembali.

## Gerbang selesai

Isolasi dua desa, pembatasan Super Admin, siklus aktivasi, reload pengaturan,
status gateway, lint/build frontend, dan pytest/Ruff backend harus lulus.

## WhatsApp terbuka dan dokumen REPORT

- Setiap akun kanal LaporPak memakai `dmPolicy: "open"`, `allowFrom: ["*"]`,
  dan `groupPolicy: "disabled"`. QR hanya menautkan perangkat desa; warga
  tidak perlu dipasangkan. Scope desa dan identitas warga tetap berasal dari
  metadata kanal tepercaya.
- REPORT baru mengantrekan **Bukti Penerimaan Laporan** pada transaksi yang
  sama dengan tiket. Transisi pertama ke `verified` mengantrekan **Laporan
  Terverifikasi**.
- Worker PostgreSQL merender PDF A4 dari snapshot data yang tersimpan,
  menyimpannya di bucket privat, dan mengirim sebagai dokumen WhatsApp.
  Kegagalan dokumen tidak membatalkan tiket.
- Kop memakai profil desa dan logo unggahan privat. PDF yang sudah terbit
  tidak ditimpa; koreksi membuat versi baru dan menyimpan audit.
- QR berisi token acak menuju `/verify/{token}`. Halaman publik hanya membuka
  metadata penerbitan dan hash SHA-256, tanpa isi laporan, warga, lampiran,
  atau file PDF.
- Tahap ini hanya berlaku untuk REPORT. QR diberi label "Verifikasi dokumen
  digital LaporPak" dan bukan tanda tangan elektronik tersertifikasi.
