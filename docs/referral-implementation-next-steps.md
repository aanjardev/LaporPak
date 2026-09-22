# Langkah penyelesaian implementasi referral

Dokumen ini meneruskan M2 tanpa memperlebar kewenangan AI atau mengaktifkan
pengiriman nyata sebelum kontrak dan izin tersedia.

## P1 — Tutup M2 di environment internal

1. Pasang versi plugin kandidat pada host OpenClaw development.
2. Buat agent operator internal terpisah dari agent WhatsApp desa.
3. Beri allowlist hanya lima tool referral M2; jangan menambahkan approval.
4. Simpan token Admin Desa uji berumur pendek di secret host, aktifkan
   `LAPORPAK_REFERRAL_TOOLS_ENABLED=true`, lalu jalankan tujuh kasus evaluasi
   menggunakan Gemini.
5. Ulangi pengujian dengan akun Desa A dan Desa B untuk membuktikan penolakan
   lintas scope dari runtime nyata. Catat model, prompt, waktu, hasil, dan biaya.

Gerbang selesai: tidak ada tool approval/status bebas, kandidat di luar hasil
backend tidak digunakan, dispatch sebelum approval ditolak, dan seluruh hasil
model dibedakan dari hasil stub.

## P2 — M3: review operator dan progres warga

Status saat ini: slice dashboard pertama selesai. Detail REPORT sudah
menampilkan kandidat backend, versi/hash paket, approval manusia, dispatch,
rekonsiliasi, tiga dimensi status, bukti, dan next action. Polling dibatasi dua
menit dan hasil mock tetap berlabel simulasi. TRACK warga juga menampilkan
progres referral yang sudah disaring tanpa routing atau identitas petugas.
Snapshot paket yang aman kini tersedia untuk review; data lama yang tidak valid
ditampilkan sebagai tidak tersedia. Daftar `case_tasks` juga sudah tersedia
pada detail REPORT dengan status aman, next action, PIC boolean, due date,
serta alasan blokir. Admin Desa dapat mengambil tugas untuk dirinya sendiri,
melepasnya dengan alasan, atau menyelesaikan tugas miliknya dengan alasan.

1. Tambahkan response review paket yang aman agar operator dapat membandingkan
   isi snapshot sebelum approval tanpa membuka metadata internal. (Selesai pada
   slice M3; tetap perlu verifikasi visual.)
2. Selesai pada slice ini: panel membaca `case_tasks` melalui endpoint yang
   dibatasi scope desa dan mendukung claim/release/complete dengan aktor dari
   token. Perubahan due date dan retry otomatis belum dibuat.
3. Selesai pada slice ini: TRACK warga menampilkan progres referral yang aman
   dan berbasis status tersimpan; detail routing internal, bukti privat,
   identitas petugas, dan data desa lain tetap disembunyikan.
4. Selesai pada slice ini: worker referral menjalankan scheduler PostgreSQL
   sederhana untuk task terbuka yang memiliki `due_at`. Event reminder memakai
   dedup key dan tetap lokal/mock; tidak ada pesan keluar atau tenggat buatan.
5. Uji desktop/ponsel, auth dua desa, konflik versi, error worker, polling, dan
   akses warga lain.

Gerbang selesai: operator selalu melihat langkah berikutnya dan warga hanya
melihat status yang didukung data tersimpan.

## P3 — M4: pilot connector resmi

1. Tentukan satu penerima dan kanal resmi yang mempunyai dokumentasi, pemilik,
   sandbox/prosedur uji, definisi receipt, serta izin tertulis.
2. Implementasikan satu adapter di balik interface connector M1; alamat dan
   credential hanya dari konfigurasi server.
3. Tambahkan contract test untuk idempotensi, lookup, timeout ambigu, callback
   signature/replay, rate limit, dan kill switch.
4. Aktifkan hanya pada desa/kanal pilot dengan volume terbatas. Jangan memakai
   data warga nyata sebelum review privasi dan operasional selesai.

Gerbang selesai: bukti registrasi/penerimaan berasal dari sistem mitra, bukan
HTTP sukses atau receipt mock.

## P4 — M5: mandat terbatas

1. Evaluasi hasil pilot dan tetapkan kategori/tujuan yang benar-benar rutin.
2. Simpan mandat eksplisit dengan penerbit, scope, masa berlaku, field yang
   boleh dibagikan, pengecualian, audit, dan pencabutan.
3. Pertahankan review manusia untuk kasus sensitif, confidence rendah, konflik
   sumber, perubahan paket, serta semua tujuan di luar mandat.
4. Uji expiry/revocation ketika job menunggu dan rollback tanpa resend.

Gerbang selesai: otomasi hanya berjalan di dalam mandat aktif dan dapat
dihentikan per desa/kanal tanpa menghapus audit atau menggandakan submit.

## Pemeriksaan wajib setiap milestone

- Backend: pytest, Ruff, koneksi/migration status, serta integrasi PostgreSQL.
- Plugin: contract/unit test dan eval stub; eval Gemini dicatat terpisah.
- Dashboard: test terkait, lint, build, dan inspeksi visual/fokus.
- Keamanan: dua desa, role, prompt injection, idempotensi, secret/log scan,
  stale lease, timeout ambigu, dan kill switch.
- Delivery: feature branch, commit terfokus, PR, review, kemudian merge; kanal
  live/deployment memerlukan instruksi dan izin terpisah.
