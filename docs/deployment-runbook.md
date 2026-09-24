# Deployment demo: Vercel, Railway dan OpenClaw VPS Linux

Status 2026-09-25: prosedur target untuk implementasi/review. VPS dan domain
belum tersedia; koneksi ke akun Cloudflare pemilik LaporPak belum berfungsi.
Jangan mengaktifkan konfigurasi yang belum didukung release terpasang.
Catat SHA FE/BE/plugin serta versi OpenClaw dalam evidence sebelum menjalankan uji. Acceptance ada pada
[release gate](mvp-demo-release-checklist.md).

## 1. Pembagian akses

Ferdi mengelola Vercel, Anjar Railway/Supabase, Farel host OpenClaw. Tim memasukkan
secret langsung pada pengelola environment masing-masing. Jangan menaruh nilai
secret, QR pairing, atau nomor pribadi pada chat, Git, PR, screenshot atau log.
Gunakan dua desa dan akun sintetis. Simpan backup konfigurasi host secara lokal
sebelum perubahan; jangan menyalin folder auth/session ke repository.

## 2. Host dan ingress — Farel bersama Anjar

1. Sediakan VPS Linux dan domain tim pada akun Cloudflare yang benar. Gunakan
   user host tersendiri dengan home persisten untuk konfigurasi dan sesi;
   jangan memasang Gateway sebagai root. Instal OpenClaw mengikuti
   [panduan Linux resmi](https://docs.openclaw.ai/install), lalu catat
   `node --version` dan `openclaw --version` (Node minimal 24.16). Pin versi
   OpenClaw yang lulus pemeriksaan ini; jangan menganggap laptop Codex sebagai host.
2. Konfigurasikan `gateway.mode=local`, `gateway.bind=loopback`, dan
   `gateway.auth.mode=token` dengan token persisten di environment host.
   Jalankan `openclaw gateway install`, aktifkan linger untuk user layanan
   (`sudo loginctl enable-linger <user-layanan>`), lalu verifikasi
   `openclaw gateway status` dan `systemctl --user status openclaw-gateway.service`.
   Pra-konfigurasi dua agent, workspace, akun WhatsApp dan binding. Simpan
   mapping desa/account di konfigurasi tepercaya. Nilai channel tidak boleh
   dipilih oleh model.
3. Pada akun Cloudflare pemilik domain, tentukan hostname khusus
   `openclaw.<domain-tim>`. Buat Access application untuk **seluruh hostname**
   dengan kebijakan Service Auth yang hanya menerima service token khusus Railway;
   jangan menambah Allow atau Bypass lain. Setelah kebijakan aktif, buat Tunnel
   yang menuju `http://127.0.0.1:<port-gateway>` dan terbitkan hostname itu.
   Pastikan `cloudflared` berjalan kembali setelah reboot dan tunnel sehat.
4. Aktifkan plugin `admin-http-rpc`, lalu verifikasi menggunakan RPC `health`.
   Plugin adalah antarmuka operator penuh; URL publik HTTPS saja tidak cukup.
   Request tanpa Access credentials wajib ditolak sebelum mencapai Gateway;
   request dengan Access valid tetapi Gateway token salah juga wajib ditolak.
5. Cocokkan `commands.list` dengan RPC health, channels.status/start/stop/logout,
   web.login.start/wait yang dibutuhkan adapter. Jangan berasumsi dokumentasi
   versi terbaru identik dengan host terpasang. Bila tidak cocok, perbarui versi
   terpin melalui review tim dan ulangi seluruh tes gateway.
6. Untuk kedua akun WhatsApp, aktifkan
   `channels.whatsapp.accounts.<id>.pluginHooks.messageReceived=true` hanya
   setelah plugin LaporPak dipercaya menangani pesan masuk. OpenClaw tidak
   mengirim hook foto WhatsApp ke plugin tanpa opt-in ini. Set
   `LAPORPAK_REQUIRE_RUNTIME_ACCOUNT=true` dan biarkan
   `LAPORPAK_CHANNEL_ACCOUNT_ID` kosong pada host dua desa. Jalankan plugin
   dari SHA PR #48 sebelum merge.
7. Pairing QR dilakukan pemilik nomor bot di browser/terminal sendiri. Catat
   hasil connected tanpa menyimpan QR. Uji ASK teks pada A/B untuk membuktikan
   `agentAccountId`, lalu REPORT berfoto pada A/B untuk membuktikan
   `accountId` hook dan isolasi media. Cocokkan tiket dengan scope backend.
   Bila salah satu konteks hilang, jangan memakai fallback akun global;
   nonaktifkan AI desa dan perbaiki versi/runtime sebelum lanjut.
   Probe kedua akun dan restart host untuk membuktikan konfigurasi serta sesi
   persisten.

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
| Kanal | Pada VPS dua desa, `LAPORPAK_REQUIRE_RUNTIME_ACCOUNT=true`; akun diambil dari metadata kanal terautentikasi. `LAPORPAK_CHANNEL_ACCOUNT_ID` kosong. Aktifkan hook WhatsApp per akun. |
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

### Identitas kanal runtime multi-desa

Plugin mengambil akun dari konteks tepercaya OpenClaw (`agentAccountId` pada tool, `accountId` pada hook), bukan argumen model. Cache foto dibatasi akun, pengirim, dan session key. Set `LAPORPAK_REQUIRE_RUNTIME_ACCOUNT=true` pada host dua desa: tool menolak panggilan tanpa identitas akun runtime, dan hook mengabaikan foto tanpa akun runtime. `LAPORPAK_CHANNEL_ACCOUNT_ID` hanya fallback host satu akun versi lama. Verifikasi versi host menyediakan konteks tersebut sebelum E2E.
