# Deployment demo: Vercel, Railway dan OpenClaw Windows

Status 2026-09-23: prosedur target untuk implementasi/review. Jangan mengaktifkan
konfigurasi yang belum didukung release terpasang. Catat SHA FE/BE/plugin serta
versi OpenClaw dalam evidence sebelum menjalankan uji. Acceptance ada pada
[release gate](mvp-demo-release-checklist.md).

## 1. Pembagian akses

Ferdi mengelola Vercel, Anjar Railway/Supabase, Farel host OpenClaw. Tim memasukkan
secret langsung pada pengelola environment masing-masing. Jangan menaruh nilai
secret, QR pairing, atau nomor pribadi pada chat, Git, PR, screenshot atau log.
Gunakan dua desa dan akun sintetis. Simpan backup konfigurasi host secara lokal
sebelum perubahan; jangan menyalin folder auth/session ke repository.

## 2. Host dan ingress — Farel bersama Anjar

1. Catat `node --version` dan `openclaw --version`; Node host minimal 24.16.
   Periksa dukungan Admin HTTP RPC pada versi yang benar-benar terpasang.
2. Pertahankan Gateway loopback dan autentikasi token. Pra-konfigurasi dua agent,
   workspace, akun WhatsApp dan binding. Simpan mapping desa/account di konfigurasi
   tepercaya. Nilai channel tidak boleh dipilih oleh model.
3. Buat Cloudflare Tunnel menuju Gateway loopback. Sebelum hostname aktif,
   buat Access application dengan kebijakan service authentication, default deny,
   dan service token khusus Railway. Jangan menambah kebijakan bypass.
4. Aktifkan plugin `admin-http-rpc`, lalu verifikasi menggunakan RPC `health`.
   Plugin adalah antarmuka operator penuh; URL publik HTTPS saja tidak cukup.
   Request tanpa Access credentials wajib ditolak sebelum mencapai Gateway;
   request dengan Access valid tetapi Gateway token salah juga wajib ditolak.
5. Cocokkan `commands.list` dengan RPC health, channels.status/start/stop/logout,
   web.login.start/wait yang dibutuhkan adapter. Jangan berasumsi dokumentasi
   versi terbaru identik dengan host terpasang. Bila tidak cocok, perbarui versi
   terpin melalui review tim dan ulangi seluruh tes gateway.
6. Pairing QR dilakukan pemilik nomor bot di browser/terminal sendiri. Catat
   hasil connected tanpa menyimpan QR. Probe kedua akun dan restart host untuk
   membuktikan konfigurasi serta sesi persisten.

Panggilan server mengirim `Authorization: Bearer <gateway-token>`,
`CF-Access-Client-Id`, dan `CF-Access-Client-Secret` ke
`POST /api/v1/admin/rpc`. Base URL hanya berasal dari konfigurasi server.
Jangan mematikan verifikasi sertifikat atau mengikuti redirect ke origin lain.
Pisahkan HTTP/gateway payload failure; tidak ada fallback sukses dari cache lama.

Sumber resmi:
[Admin HTTP RPC](https://docs.openclaw.ai/plugins/admin-http-rpc),
[remote access](https://docs.openclaw.ai/gateway/remote).

## 3. Environment target

Nilai di bawah adalah nama variabel dan keputusan, bukan berkas siap deploy.
Tambahkan nama ke `.env.example` bersamaan dengan implementasi, tanpa secret.

| Komponen | Konfigurasi |
|---|---|
| Railway | `APP_ENV=production`, `ALLOW_DEMO_KNOWLEDGE=true`, `FRONTEND_URL` origin Vercel |
| Railway -> host | `OPENCLAW_API_URL` HTTPS, `OPENCLAW_GATEWAY_TOKEN`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` |
| Railway -> Supabase | Konfigurasi database/Auth/Storage backend yang sudah digunakan |
| OpenClaw -> Railway | `LAPORPAK_API_URL`, `LAPORPAK_API_KEY` sesuai `OPENCLAW_API_KEY` FastAPI |
| OpenClaw -> Gemini | `GEMINI_API_KEY` hanya pada host AI |
| Kanal | `LAPORPAK_CHANNEL_ACCOUNT_ID` per runtime terisolasi, atau metadata akun terautentikasi yang didukung plugin |
| Vercel | `REPORTS_DATA_SOURCE=api`, URL FastAPI dan konfigurasi Supabase Auth publik yang sudah digunakan |

Flag demo adalah pengecualian eksplisit pada data sintetis; jangan mengubah
`APP_ENV` menjadi development untuk membuka aksesnya. UI harus menampilkan
label simulasi meski sumber laporan adalah API nyata.

## 4. Deployment dan pengecekan

1. Merge PR kontrak setelah review. Branch implementasi mengikuti urutan release gate.
2. Jalankan semua test/lint/build yang diminta. CI mencakup dashboard, TypeScript,
   plugin dan evaluasi deterministik; jangan memasukkan credential live ke job PR.
3. Deploy backend, konfigurasi host, lalu frontend pada release candidate yang
   kompatibel. Catat SHA setiap komponen. Tidak ada migration/reset database
   untuk pekerjaan ini kecuali kebutuhan baru disepakati lewat kontrak.
4. Periksa `/health` dan `/ready`. Railway tetap menggunakan `/health` untuk
   liveness; ketergantungan OpenClaw yang degraded tidak memicu restart API.
5. Periksa role redirect, private media 401, CSP, login/logout, daftar/detail,
   status, halaman ASK/REQUEST, dashboard dan error tanpa mock fallback.
6. Jalankan embedding worker untuk sumber demo kedua desa. Pastikan status ready,
   tetapi KPI sumber resmi tetap tidak menghitung dokumen demo.
7. Jalankan matriks E2E bersama pemilik nomor uji. Runner hybrid hanya membuktikan
   live ASK/TRACK untuk bagian yang memanggil API; hasil deterministik diberi label.

Jangan menjalankan `seed`/migration secara membabi buta pada Supabase yang sudah
berisi data. Gunakan status migration dan importer idempotent yang tersedia,
verifikasi target environment sebelum menambah sumber sintetis.

## 5. Gangguan dan rollback

Jika frontend/backend gagal, rollback deployment komponen terkait ke SHA terakhir
yang lulus. Simpan database; jangan rollback dengan reset/menghapus tabel. Jika
scope/AI tidak aman, matikan AI desa dan gunakan dashboard manual. Jika Access
atau Gateway auth gagal, perbaiki credential/ingress; jangan buka akses publik
atau menghapus autentikasi sebagai fallback. Restore konfigurasi host dari
backup lokal bila diperlukan dan ulangi probe dua akun.

MVP demo ready baru dicatat setelah matriks lengkap lulus. Sumber ASK resmi,
SOP layanan, provisioning otomatis dan operasi produksi tetap pekerjaan terpisah.
