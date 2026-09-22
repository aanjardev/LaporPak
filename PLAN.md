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

## UX feedback tindakan

Tahap ini memakai komponen bersama tanpa notification center atau tabel baru:

1. API client bertipe dengan tenggat, pemulihan token satu kali, dan pesan aman
   untuk kegagalan umum.
2. Toast, pesan inline, indikator proses lambat, dan dialog konfirmasi yang
   dapat dipakai ulang.
3. Penyimpanan profil menjelaskan hasil akun, profil, dan logo secara terpisah
   serta menjaga perubahan yang belum disimpan.
4. PDF membedakan render dan pengiriman WhatsApp, polling berhenti setelah dua
   menit, serta revisi/pencabutan memakai dialog beralasan.
5. Keputusan REPORT, REQUEST, aktivasi, pemutusan WhatsApp, dan penonaktifan
   knowledge meminta konfirmasi sebelum mutasi.

Keberhasilan hanya diumumkan setelah backend mengonfirmasi. Kegagalan refresh
setelah mutasi mengarahkan pengguna memuat data terbaru tanpa submit ulang.

## Pengaturan dan Sumber ASK

- Pengaturan Admin Desa memakai dua tab berbasis URL: `/reports/settings` untuk
  akun, profil, WhatsApp, dan AI; `/reports/settings/knowledge` untuk Sumber ASK.
- Sumber ASK tidak lagi menjadi menu utama. URL lama `/reports/knowledge`
  mengarahkan ke tab baru dan mempertahankan parameter feedback yang dikenal.
- Form akun dan knowledge memperingatkan sebelum navigasi ketika ada perubahan
  yang belum disimpan. Tidak ada data form yang disimpan di browser storage.
## Referral REPORT M0-M3

Spesifikasi tambahan berada di
[`docs/LAPORPAK_CODEX_IMPLEMENTATION_PLAN.md`](docs/LAPORPAK_CODEX_IMPLEMENTATION_PLAN.md).
M0-M1 menambah penerusan backend melalui kanal mock sintetis, paket berversi,
approval terikat hash, outbox persisten, rekonsiliasi, dan guard status
`forwarded`. M2 menambah lima tool operator OpenClaw yang opt-in, schema output,
prompt clarification, serta evaluasi keselamatan. Tidak ada tool approval,
tool referral tidak tersedia pada sesi WhatsApp warga, dan kanal live tetap
nonaktif. Bagian awal M3 menambahkan panel review referral pada detail REPORT:
kandidat backend, versi/hash paket, approval manusia, dispatch idempoten,
rekonsiliasi hasil ambigu, tiga dimensi status, bukti, dan next action. M3 belum
mencakup pengelolaan `case_tasks` atau scheduler. TRACK warga kini dapat
menampilkan progres rujukan yang sudah disaring oleh backend. M4-M5 tetap
roadmap dan belum diaktifkan.
