# Release gate MVP demo LaporPak

Tanggal keputusan: 2026-09-23. Baseline kode: `85587a9`.
Status: keputusan kontrak telah disepakati tim dan PR #40 telah digabung.
Implementasi lokal telah diuji; deployment dan E2E di bawah belum ditutup. Dokumen ini bukan bukti bahwa MVP sudah selesai.

## Target dan batas demo

Target adalah demo hackathon dengan dua desa sintetis, dua admin desa, dan dua
identitas warga WhatsApp uji. Tim menyatakan akun dan host tersedia; kesiapan
runtime tetap harus dibuktikan. Pisahkan nomor bot desa dari nomor warga uji.
ASK memakai sumber `demo` berlabel **Data simulasi**; REQUEST domisili adalah
prototipe dengan SOP belum resmi. Keputusan petugas tetap disimpan oleh backend.
Data sintetis di database berbeda dari mock frontend: deployment memakai API nyata.

Pengiriman PDF lewat WhatsApp, provisioning desa baru otomatis, dan konektor
rujukan eksternal bukan gerbang demo. Unduhan PDF admin tetap diuji. Keterbatasan
pengiriman tidak boleh ditampilkan sebagai berhasil. Referral sintetis tidak
boleh diklaim sebagai penerimaan instansi nyata.

## Urutan implementasi dan review

| Branch | Hasil | Reviewer |
|---|---|---|
| `docs/mvp-demo-release-gate` | Kontrak, batas demo, runbook dan acceptance | Ferdi, Anjar, Farel |
| `feat/openclaw-remote-gateway` | Adapter remote dan konfigurasi host yang terdokumentasi | Anjar + Farel |
| `fix/backend-mvp-readiness` | Kill switch, ASK, agregasi, lampiran, readiness | Anjar |
| `fix/frontend-mvp-readiness` | Fail closed, proxy dan security headers | Ferdi |
| `test/mvp-demo-e2e` | CI, pengujian deployment dan bukti akhir | Seluruh tim |

Branch implementasi dimulai setelah PR kontrak masuk `main`. Sinkronkan kontrak
yang sama; jangan menganggap review tim selesai hanya karena dokumen ditulis.
Setiap branch melalui PR dan review pemilik role sebelum merge. Jangan push
langsung ke `main`. Ambil SHA baru untuk release candidate setelah seluruh PR
implementasi digabung; baseline di atas bukan SHA hasil pengujian berikutnya.

## Kontrak backend dan gateway

Detail API berada di [api-contract.md](api-contract.md#kontrak-penutupan-demo-2026-09-23).
Railway memanggil host Windows melalui Cloudflare Tunnel + Access, lalu Admin
HTTP RPC OpenClaw. Gateway tetap loopback. Token arah Railway ke Gateway harus
berbeda dari API key arah OpenClaw ke FastAPI.

- [ ] Anjar/Farel membuktikan HTTPS, Access service token, Gateway bearer token,
  dan versi OpenClaw host mendukung RPC yang dibutuhkan.
- [ ] Dua agent/workspace/account/binding dipra-konfigurasi pada host persisten.
- [ ] Status, pairing/wait, start/stop dan logout hanya menyentuh akun yang diminta.
- [ ] Akun belum diprovisioning menghasilkan `409 OPENCLAW_PROVISIONING_REQUIRED`.
- [ ] Adapter remote tidak menulis workspace Railway atau fallback ke CLI lokal.
- [ ] Timeout, payload invalid, token salah dan gateway down ditangani tanpa secret.
- [ ] Restart host mempertahankan sesi/config; probe GET tidak me-restart semua akun.

Plugin saat ini membaca `LAPORPAK_CHANNEL_ACCOUNT_ID` dari environment proses.
Farel wajib membuktikan pemetaan dua akun tidak memakai satu nilai global untuk
keduanya. Gunakan konteks kanal terautentikasi yang didukung versi host atau
runtime terisolasi per akun; keputusan runtime dicatat sebelum dua desa diaktifkan.
Nama desa dari pesan/model tidak boleh menjadi sumber scope.

## Pekerjaan Anjar

- [ ] Tolak seluruh tool warga OpenClaw dengan `503 AI_DISABLED` ketika metadata
  desa `is_ai_enabled=false`, sebelum retrieval, persistence atau pengiriman.
  Autentikasi dan scope tetap diperiksa lebih dahulu. Jalur admin tetap berjalan.
- [ ] `ALLOW_DEMO_KNOWLEDGE=false` default; flag eksplisit menggantikan izin demo
  implisit dari `APP_ENV=development`, baik retrieval maupun antrean embedding.
- [ ] Dokumen canonical saja dihitung pada KPI, attention count, dan antrean.
  `ask_ready` tetap `active + approved + ready`; sumber demo tidak dihitung resmi.
- [ ] Validasi JPEG/PNG/WebP maksimal 5 MiB, decode penuh, maksimal 25 juta pixel
  dan 10.000 pixel per sisi; tolak animasi/multiframe dan gambar rusak. Encode
  ulang tanpa metadata/trailing data; validasi ukuran hasil sebelum upload privat.
  Orientasi foto dipertahankan. Uji rollback bila upload atau transaksi gagal.
- [ ] `/health` tetap liveness. `/ready` memeriksa database dan konfigurasi wajib,
  mengembalikan `503` bila dependency inti gagal. OpenClaw down menghasilkan
  status degraded dengan HTTP `200` bila API inti sehat. Railway tetap probe `/health`.
- [ ] Dokumentasi `/docs`, `/redoc`, `/openapi.json` dinonaktifkan di production.

## Pekerjaan Ferdi

- [ ] Production Vercel hanya menerima `REPORTS_DATA_SOURCE=api`; nilai hilang
  atau invalid menghasilkan kegagalan konfigurasi, bukan data/mock sukses.
  Mock hanya eksplisit di local/preview; build production tidak mengaktifkannya.
- [ ] Proxy PDF/logo tanpa sesi mengembalikan `401`; status upstream 401/403/404
  diteruskan, network/service failure aman. Validasi Content-Type sebelum stream.
- [ ] Header CSP, `nosniff`, referrer/permissions policy, anti-frame dan CORP
  privat terpasang; `X-Powered-By` dihapus. Uji CSP dengan hydration, Server Actions,
  Supabase login, pairing QR, gambar dan PDF agar tidak memblokir alur aplikasi.
- [ ] ASK demo berlabel sesuai `review_status`/`trust_level`; REQUEST demo jelas
  disebut prototipe. Perubahan label tidak mengubah nilai enum atau keputusan API.
- [ ] Loading, nol, error dan navigasi tetap berfungsi pada 390/768/1280 px.

## Pekerjaan Farel

- [ ] Minimal satu sumber canonical berstatus `demo` per desa, dengan fakta
  sintetis berbeda untuk menguji kebocoran konteks. Jangan menaikkannya ke approved.
- [ ] Worker embedding diproses hingga ready; kegagalan ditandai failed dan retry diuji.
- [ ] `AI_DISABLED` menghasilkan pesan layanan otomatis nonaktif dan petunjuk
  menghubungi petugas tanpa mengarang kontak, mengulang tool terus, atau tiket palsu.
- [ ] Eval ASK/TRACK API nyata dan percakapan WhatsApp dijalankan pada release SHA.
  Runner hybrid berisi skenario deterministik; lulus runner bukan bukti seluruh
  percakapan memakai Gemini nyata. Pisahkan label kedua jenis hasil.

## Matriks E2E wajib

Jalankan pada deployment dan database yang sama. Kode A/B hanya alias; simpan
pemetaan nomor dan akun di luar Git. Uji gangguan dilakukan pada lingkungan
demo terkendali, bukan dengan mematikan layanan yang dipakai orang lain.

| Skenario | Hasil yang wajib diamati | Status |
|---|---|---|
| REPORT A/B teks, lokasi, foto, konfirmasi | Tiket tersimpan di desa pengirim; foto hanya admin berwenang | Belum diuji |
| Data REPORT belum lengkap/batal | Klarifikasi atau pembatalan; tidak ada tiket palsu | Belum diuji |
| Retry draf identik | Satu entity dan satu initial history; payload berbeda ditolak | Belum diuji |
| Verifikasi/tolak, satu REPORT sampai resolved | Status, alasan, waktu, history konsisten setelah reload | Belum diuji |
| TRACK pemilik, nonpemilik, lintas desa | Hanya pemilik membaca; lainnya scoped 404 | Belum diuji |
| ASK sumber A/B dan pertanyaan tanpa sumber | Jawaban berlabel simulasi, sumber sesuai desa, fallback aman | Belum diuji |
| Prompt injection/permintaan data desa lain | Tidak ada bocoran atau keputusan administratif AI | Belum diuji |
| REQUEST setelah konfirmasi pesan terpisah | Satu tiket; keputusan manusia dan TRACK konsisten | Belum diuji |
| Admin A mengakses entitas B | Daftar scoped; detail/foto/PDF/mutation ditolak | Belum diuji |
| 401/403/404/409/network/service failure | UI/tool aman dan tidak mengklaim sukses | Belum diuji |
| Kill switch A, B tetap aktif | Semua tool A ditolak; B bekerja; admin A tetap memproses | Belum diuji |
| Aktifkan kembali AI A | Layanan pulih tanpa replay operasi tidak sah | Belum diuji |
| KPI dan antrean | Cocok query database canonical; semua status termasuk nol | Belum diuji |
| Logout/reload, layar dan keyboard | Sesi/proteksi benar, tidak ada overflow atau fokus hilang | Belum diuji |
| Health/readiness/security headers | HTTP sesuai kontrak; tidak ada mock production | Belum diuji |

## Verifikasi, bukti dan rollback

Jalankan semua test frontend termasuk dashboard, lint, TypeScript dan build;
backend pytest/Ruff; test plugin dan FTS. CI menjalankan evaluasi deterministik
tanpa secret; eval live dijalankan terpisah. Jangan menjalankan runner yang
menulis ulang evidence tracked tanpa meninjau perubahan hasilnya.

Gunakan [p0-verification-evidence.md](p0-verification-evidence.md) untuk tanggal,
release SHA setiap komponen, versi Node/OpenClaw, environment, alias desa/admin,
tiket sintetis, expected/actual, hasil pass/fail, dan batas simulasi. Jangan commit
token, QR, nomor lengkap, percakapan pribadi, Storage path, atau payload gambar.
Checkbox ditutup hanya dengan tautan bukti terverifikasi.

Jika deployment gagal, rollback Vercel/Railway ke SHA sebelumnya dan kembalikan
konfigurasi host dari backup lokal. Nonaktifkan AI desa jika tool tidak aman;
dashboard manual tetap tersedia. Tidak ada reset database atau replay migration.

**MVP demo ready** hanya setelah seluruh matriks wajib lulus dan ketiga role
meninjau bukti. **Production ready** masih terbuka: sumber dan SOP resmi,
operasi/backup/incident response, uji beban, pengamanan lampiran lanjutan,
provisioning desa otomatis dan transport PDF WhatsApp. Tidak ada klaim antivirus
hanya berdasarkan decode/re-encode gambar.

## Progres implementasi 24 September 2026

Adapter remote, backend readiness, frontend hardening, dan plugin kill switch telah dibuat pada branch terpisah yang saling bergantung. Bukti lokal dan pemeriksaan deployment dicatat di `p0-verification-evidence.md`. Sumber sintetis A/B tersedia di `data/knowledge-base/demo/`, belum diunggah atau di-embedding. Semua checkbox deployment tetap terbuka sampai release candidate yang sama terpasang di Vercel, Railway, dan host OpenClaw.
