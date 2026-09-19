# Rencana pengembangan MVP LaporPak

> Status: rencana kerja tim, diperbarui 2026-09-19. Dokumen ini mengatur urutan, pembagian
> tugas, dependensi, dan bukti selesai. Ini bukan kontrak API atau pengganti PRD.
> Semua contoh dan pengujian memakai data serta akun uji; jangan mencatat
> kredensial, token, nomor WhatsApp pribadi, atau isi laporan warga nyata.

## 1. Acuan dan arti selesai

- [PRD V3](prd/PRD_V3_AI_Village_Service_Agent.md) menetapkan cakupan dan
  Definition of Done MVP. REPORT dan ASK termasuk **MUST HAVE**; TRACK dan
  prototipe REQUEST satu layanan termasuk **SHOULD HAVE**. Definition of Done
  juga mensyaratkan approval gate untuk REQUEST yang berdampak pada warga.
- Sesuai [project-context.md](project-context.md), tim tetap menargetkan
  **REPORT, ASK, TRACK, REQUEST, dan multi-desa dalam MVP**. Label prioritas PRD
  menentukan urutan kerja, bukan menghapus komitmen tersebut.
- [p0-integration-checklist.md](p0-integration-checklist.md) tetap mengatur
  penutupan REPORT. Bukti historis dan hasil uji ulangnya berada di
  [p0-verification-evidence.md](p0-verification-evidence.md).
- [api-contract.md](api-contract.md) menentukan payload, enum, endpoint, dan
  error; [architecture.md](architecture.md) menentukan kepemilikan data dan
  batas komponen; [workflows.md](workflows.md) menentukan alur serta fallback.
  Perubahan lintas role harus masuk ke dokumen tersebut sebelum atau bersama
  implementasi, lalu disampaikan ke Ferdi, Anjar, dan Farel.

**Status terkini:** satu alur REPORT WhatsApp hingga verifikasi dashboard pernah
berhasil didemokan, tetapi checklist integrasi terbaru belum seluruhnya lulus.
Repository sudah memiliki API dan tool OpenClaw untuk ASK dan TRACK REPORT, pengelolaan
sumber ASK di dashboard, serta API REQUEST `residency_letter`. Frontend REQUEST
baru berupa pratinjau sintetis yang tidak memanggil API. OpenClaw belum memiliki
tool submit REQUEST. Keberadaan route, tabel, tool, dan UI tidak membuktikan SOP
resmi, isolasi dua desa, atau alur end-to-end telah lulus.

## 2. Urutan dan dependensi

| Tahap | Hasil yang dituju | Dependensi untuk menyatakan selesai |
|---|---|---|
| 0. Tutup REPORT dan gerbang bersama | Alur nyata, keputusan petugas, status, izin, dan fallback terbukti | Data uji baru; ketiga role memakai commit dan lingkungan yang sama |
| 1. ASK dari sumber resmi | Warga mendapat jawaban yang didukung sumber atau diarahkan ke klarifikasi/handoff | Pemilik konten menyetujui SOP/FAQ uji; kontrak dan evaluasi disepakati |
| 2. TRACK tiket | Warga melihat status resmi tiket miliknya lewat WhatsApp | Identitas pengirim dan izin baca disepakati; riwayat REPORT tersedia |
| 3. REQUEST satu layanan | Warga menyiapkan pengajuan; petugas menyetujui/menolak secara resmi | Satu layanan, SOP, field wajib, dan pejabat pemberi keputusan dipilih |
| 4. Multi-desa | Data, petugas, sumber ASK, dan layanan terpisah per desa | Alur satu desa stabil; model cakupan desa dan migrasi ditinjau bersama |

Desain kontrak dan fixture tahap berikut boleh dikerjakan paralel. Klaim
integrasi baru dibuat setelah alur tersebut diuji pada komponen nyata. Untuk
demo satu desa, selesaikan tahap 0 sebelum menyebut REPORT stabil. Sebelum
beberapa desa memakai sistem, tahap 4 harus lulus. Pekerjaan pengamanan pada
bagian 7 berjalan bersama semua tahap, bukan ditunda sampai akhir.

**Langkah kerja terdekat:** Ferdi, Anjar, dan Farel menutup skenario nyata yang
masih terbuka pada checklist REPORT. Setelah itu, tim memvalidasi ASK dan TRACK
melalui kanal uji memakai sumber yang disetujui. Untuk REQUEST, tim meninjau
kontrak teknis yang sudah ada, menetapkan SOP Surat Keterangan Domisili, data
minimum, dan pejabat berwenang sebelum pratinjau frontend dihubungkan ke API.

## 3. Tahap 0 — penutupan REPORT

**Ferdi — frontend (`apps/dashboard/`)**

- Uji daftar, detail, pencarian/filter, pagination, logout, dan semua state
  gagal memakai FastAPI atau server simulasi; labeli sumber tiap hasil.
- Uji verifikasi **dan** penolakan pada dua laporan `pending_verification` yang
  berbeda. Setelah reload, cocokkan status, waktu, dan riwayat dengan respons
  FastAPI. Dua laporan lama berstatus `verified` tidak menggantikan uji ini.
- Lengkapi aksi petugas untuk `in_progress`, `forwarded`, dan `resolved`
  sesuai transisi dalam kontrak; tampilkan hanya aksi yang tersedia dari
  status saat ini dan gunakan status resmi hasil baca ulang API. FastAPI tetap
  menjadi penentu sah atau tidaknya transisi.
- Tampilkan ringkasan dan rekomendasi urgensi AI sebagai informasi pendukung,
  dengan keputusan akhir tetap pada petugas dan aturan backend.
- Periksa daftar, detail, formulir, dan pesan kegagalan di ponsel/desktop;
  pertahankan sesi server dan jangan mengakses tabel Supabase langsung.

**Anjar — backend dan database (`services/api/`, `database/`)**

- Sediakan laporan uji baru dan buktikan GET/PATCH, transisi yang sah/tidak sah,
  penyimpanan alasan, serta status history dalam satu lingkungan uji.
- Terapkan dan uji otorisasi admin aktif, peran, serta cakupan desa pada setiap
  GET/PATCH sebelum data nyata dibuka untuk deployment publik. Token Supabase
  yang valid saja belum membuktikan pengguna berhak melihat semua laporan.
- Buktikan satu ID draf dan retry hanya menghasilkan satu tiket; payload
  berbeda dengan key sama ditolak; kegagalan persistence tidak memberi sukses.
- Pertahankan migrasi baru untuk perubahan schema dan audit status minimal.

**Farel — AI dan OpenClaw (`integrations/openclaw/`, host AI)**

- Jalankan ulang REPORT lengkap, informasi kurang, koreksi warga, konfirmasi,
  `UNKNOWN`, pesan berulang, output AI tidak valid, dan kegagalan Gemini/API
  melalui kanal uji yang benar-benar aktif.
- Pastikan ID draf stabil, tool create hanya dipanggil sesudah konfirmasi,
  identitas pengirim berasal dari metadata WhatsApp, dan AI tidak dapat
  memanggil mutation status petugas.

**Gerbang selesai:** satu laporan baru mengalir dari WhatsApp sampai status
petugas tersimpan; verifikasi dan penolakan pada laporan berbeda serta fallback
relevan lulus. Catat tanggal, commit SHA, lingkungan, observasi, dan pembatasan
uji pada checklist serta bukti P0. Uji simulasi tidak membuktikan izin backend.

## 4. Tahap 1 — ASK berbasis knowledge yang disetujui

Mulai dari beberapa pertanyaan layanan desa yang benar-benar mempunyai sumber
resmi. Pemilik konten yang ditunjuk tim harus memeriksa akurasi, desa yang
berlaku, versi, dan tanggal peninjauan sebelum materi disebut “disetujui”.
Konten contoh buatan tim tetap diberi label data uji. Dashboard sudah memiliki
pengelolaan sumber; keberadaannya tidak menggantikan persetujuan pemilik konten.

**Ferdi — frontend**

- Kanal ASK warga tetap WhatsApp; tidak perlu halaman chatbot warga terpisah.
- Dashboard sudah memiliki daftar, tambah, edit, dan nonaktifkan sumber ASK
  melalui FastAPI, termasuk state sesi, akses ditolak, dan kegagalan layanan.
  Uji kembali dengan sumber resmi dan cakupan desa nyata.
- Jangan membuka file knowledge privat atau tabel Supabase langsung dari browser.

**Anjar — backend dan database**

- Pertahankan kontrak pencarian ASK, cakupan desa, metadata sumber, serta
  respons ketika tidak ada sumber yang layak. Route pengelolaan dan retrieval
  sudah ada; buktikan ingestion dapat diulang untuk sumber yang disetujui.
- Batasi retrieval ke sumber aktif yang disetujui; simpan referensi sumber dan
  versi yang dipakai agar jawaban dapat diaudit. Akses database tetap lewat
  FastAPI, bukan tool SQL langsung pada OpenClaw.
- Mulai dari retrieval paling sederhana yang lulus dataset evaluasi. Aktifkan
  `pgvector` melalui migrasi hanya jika pencarian semantik benar-benar perlu;
  ketersediaannya belum dianggap terverifikasi.

**Farel — AI dan OpenClaw**

- Klasifikasi ASK dan tool `laporpak_ask` sudah tersedia. Uji pada host aktif
  bahwa jawaban hanya memakai answer blocks dan sumber dari FastAPI.
- Saat sumber kosong, kedaluwarsa, bertentangan, atau pertanyaan ambigu,
  minta klarifikasi atau tawarkan handoff. Jangan mengarang biaya, syarat,
  tenggat, atau kebijakan desa.
- Susun evaluasi berisi pertanyaan yang tercakup, tidak tercakup, salah desa,
  sumber lama, dan prompt injection; catat tingkat jawaban yang benar dan
  fallback yang terjadi.

**Gerbang selesai:** pertanyaan yang tercakup dijawab dari sumber disetujui;
pertanyaan di luar sumber tidak menghasilkan informasi resmi karangan. Tidak
ada akses database atau credential dari AI.

## 5. Tahap 2 — TRACK dari status resmi

TRACK membaca tiket REPORT terlebih dahulu. Dukungan tiket REQUEST dapat
ditambahkan setelah tahap 3. Nomor tiket bukan bukti kepemilikan; akses warga
harus dikaitkan dengan metadata pengirim dari kanal terautentikasi dan relasi
citizen/tiket yang diverifikasi FastAPI. Respons gagal tidak boleh membocorkan
apakah tiket warga lain ada.

**Ferdi — frontend**

- Pastikan perubahan status dan riwayat di dashboard tetap jelas agar hasil
  yang dibaca TRACK sesuai tindakan petugas. Tidak perlu halaman TRACK warga
  terpisah pada MVP WhatsApp.
- Jika dibutuhkan petugas, tambahkan tautan/penyalinan nomor tiket pada detail
  tanpa mengekspos identitas atau status warga lain.

**Anjar — backend dan database**

- Endpoint TRACK dan pembatasan kepemilikan sudah tersedia. Tinjau kontrak
  error aman dan buktikan status/riwayat berasal dari system of record.
- Ikat pengirim WhatsApp ke citizen pemilik tiket, tegakkan cakupan desa, dan
  batasi field pribadi pada respons. Uji tiket milik sendiri, tiket orang
  lain, tiket tidak ada, dan layanan database gagal.

**Farel — AI dan OpenClaw**

- Prompt TRACK dan tool `laporpak_track_report` sudah tersedia. Uji nomor tiket
  eksplisit dan daftar tiket terbaru dengan metadata pengirim kanal nyata.
- Sampaikan status dan waktu yang dikembalikan backend apa adanya; jangan
  menyimpulkan progres atau menjanjikan tanggal selesai. Jika akses ditolak
  atau API gagal, berikan respons aman dan jalur handoff.

**Gerbang selesai:** warga pemilik tiket mendapat status resmi terbaru;
pengirim lain tidak memperoleh status atau data pribadi, termasuk melalui
percakapan yang mencoba menyamar sebagai pemilik.

## 6. Tahap 3 — REQUEST untuk satu layanan

Prototipe teknis memilih `residency_letter` (Surat Keterangan Domisili), tetapi
pilihan itu belum menjadi SOP layanan yang disahkan. Ferdi, Anjar, Farel, dan
pemilik SOP desa harus mencatat syarat, data yang
boleh diminta, pejabat yang menyetujui, hasil yang boleh dikirim, dan kapan
pengajuan dianggap resmi. Jangan menebak SOP atau menerbitkan dokumen resmi
dari AI. Entitas, status, dan nomor pengajuan REQUEST disepakati dalam kontrak
tersendiri; jangan memakai status REPORT untuk domain layanan yang berbeda.
Pilih layanan dengan SOP tertulis, pemilik keputusan yang tersedia, kebutuhan
data minimum, dan hasil yang dapat didemokan tanpa penerbitan otomatis.

**Ferdi — frontend**

- Pratinjau antrean, detail, pagination, dan keputusan approve/reject sudah ada
  dengan data sintetis dan hanya aktif melalui konfigurasi development.
- Setelah kontrak disahkan, ganti simulasi dengan API, tampilkan riwayat resmi,
  tangani `401`/`403`/`404`/`409`/`503`, dan baca ulang hasil setelah mutation.
- Uji tampilan ponsel/desktop dan pembatasan sesi. Jangan mengirim approval
  otomatis berdasarkan rekomendasi AI.

**Anjar — backend dan database**

- Pydantic schema, tabel/migrasi, endpoint create/list/detail/status,
  idempotensi, cakupan admin, dan audit keputusan sudah tersedia sebagai
  baseline teknis. Tinjau bentuk detail/riwayat dan selaraskan dengan SOP final.
- Pisahkan draf/persiapan dari submit resmi dan dari keputusan administratif;
  validasi field wajib serta otorisasi pada setiap langkah. Simpan keputusan
  dan riwayat secara atomik; hindari klaim sukses saat persistence gagal.

**Farel — AI dan OpenClaw**

- Siapkan flow dan tool submit REQUEST setelah SOP serta kontrak disahkan.
  Repository belum memiliki tool OpenClaw untuk membuat pengajuan layanan.
- Jangan approve/reject, mengubah data resmi, atau mengarang hasil dokumen.
  Tangani data kurang, ketidakjelasan, pengiriman ulang, dan kegagalan API
  dengan klarifikasi/handoff.

**Gerbang selesai:** satu pengajuan nyata dari WhatsApp dapat diajukan,
ditinjau petugas, diputuskan oleh manusia, dan dilacak dengan audit. Submit
ulang tidak membuat pengajuan ganda; AI tidak dapat melewati approval gate.

## 7. Pengamanan dan pekerjaan lintas tahap

| Kebutuhan PRD | Ferdi — FE | Anjar — BE/database | Farel — AI/OpenClaw | Bukti minimum |
|---|---|---|---|---|
| Auth dan isolasi data | Sesi admin, state `401`/`403`, UI hanya menampilkan data dari API | Admin aktif, peran, cakupan desa pada setiap read/write; tes lintas desa dan `404` aman | Tool memakai identitas kanal dan izin minimum | Pengguna tanpa hak gagal membaca/mengubah data |
| Audit aksi penting | Tampilkan riwayat yang aman untuk petugas | Catat create, perubahan status, approval, eskalasi, dan tool action yang berdampak | Bawa ID operasi/korelasi tanpa menulis status resmi | Aktor, waktu, aksi, dan hasil bisa ditelusuri |
| Handoff, manual mode, kill switch | UI antrean/indikator handoff dan kontrol admin berizin untuk mengaktifkan mode manual | Aturan dan izin penghentian aksi AI; jalur manual tetap berjalan | Hentikan tool aksi saat mode aktif; jelaskan fallback ke warga | AI action berhenti, petugas tetap bisa memproses |
| Kontrol lampiran | Render metadata/tautan yang diizinkan; jangan membuka bucket privat langsung | Validasi tipe/ukuran, private storage, izin akses, penolakan berkas berbahaya | Perlakukan media sebagai bukti tidak tepercaya; jangan anggap gambar sebagai fakta | Berkas salah/berbahaya tidak diproses sebagai bukti sah |
| Spam, biaya, dan kegagalan | Pesan gagal yang jelas tanpa detail internal | Rate limit/kuota operasional dan transaksi aman | Batas percakapan/tool, retry terkendali, fallback saat provider gagal | Tidak ada tiket/aksi palsu atau biaya tak terkendali saat gagal |
| Potensi duplikasi & insight dasar | Tampilkan tanda dugaan duplikat dan ringkasan agregat bila tersedia | Idempotensi teknis wajib; kemiripan semantik hanya flag; hitung agregat tanpa data pribadi berlebih | Rekomendasi hanya advisory | Retry tidak menggandakan tiket; laporan mirip tidak otomatis ditolak |

Kontrol dasar yang tercantum dalam Definition of Done MVP tidak boleh ditukar
dengan UI yang tampak selesai. Untuk attachment, validasi dan penyimpanan aman
baru diuji saat pengiriman media masuk scope; lampiran tidak dijadikan field
wajib warga untuk REPORT. Analytics tetap prioritas setelah alur operasional
dan kontrol akses terbukti.

## 8. Tahap 4 — multi-desa

**Ferdi:** tampilkan konteks desa dan cakupan petugas dari API pada halaman
yang relevan; filter desa hanya membantu navigasi, bukan mekanisme keamanan.
Uji perpindahan konteks, data kosong, dan akses ditolak.

**Anjar:** buat migrasi bernomor baru untuk relasi desa, keanggotaan/peran admin,
serta cakupan laporan, knowledge, dan pengajuan. Tegakkan scope di setiap
query/detail/mutation/approval dan tentukan perilaku `404`/`403` sesuai
kontrak. Uji dua desa dengan tiket serta admin berbeda, termasuk akses silang.

**Farel:** teruskan konteks desa yang telah diverifikasi backend; pilih sumber
ASK dan tool sesuai desa, minta klarifikasi jika desa belum pasti, dan jangan
menebak cakupan dari teks warga saja.

**Gerbang selesai:** data, pengetahuan, dan pengajuan dua desa tetap terpisah
di API dan kanal WhatsApp. Deployment multi-desa ditahan jika satu akses silang
masih berhasil.

## 9. Cara bekerja dan mencatat kemajuan

1. Sebelum tahap baru, tulis keputusan domain di PR terkait: sumber/SOP yang
   disetujui untuk ASK, model bukti kepemilikan TRACK, atau layanan REQUEST
   terpilih. Jika belum disepakati, tandai **keputusan terbuka** dan lanjutkan
   pekerjaan independen; jangan membuat kontrak diam-diam.
2. Perbarui `api-contract.md` untuk endpoint, payload, enum, error, dan izin;
   `workflows.md` untuk percakapan/fallback; `architecture.md` untuk ownership,
   schema, dan trust boundary. FE dan AI boleh memakai mock yang sama setelah
   kontrak ditinjau bersama.
3. Kerjakan di branch role masing-masing, uji unit/kontrak pada boundary, lalu
   gabungkan lewat PR. Migration yang telah dijalankan tidak diedit.
4. Untuk setiap gerbang, catat tanggal, SHA commit, lingkungan, data sintetis,
   langkah uji, hasil nyata, dan pemilik perbaikan di PR atau bukti uji yang
   ditautkan dari rencana ini. Bedakan API/kanal nyata dari simulasi. Centang
   tahap hanya setelah skenario normal, akses tanpa hak, retry, dan kegagalan
   yang relevan lulus.

| Tahap | Status awal | Bukti/PR saat lulus |
|---|---|---|
| REPORT dan gerbang bersama | Berjalan; lihat checklist P0 | [Checklist](p0-integration-checklist.md) dan [bukti](p0-verification-evidence.md) |
| ASK | API, tool, evaluasi, dan UI sumber tersedia; sumber resmi dan E2E belum disahkan | Tautkan PR dan hasil evaluasi sumber di sini |
| TRACK | API mendukung REPORT/REQUEST; tool OpenClaw saat ini hanya menerima tiket `LP-*`; uji kepemilikan kanal nyata dan dukungan `REQ-*` masih terbuka | Tautkan PR dan uji kepemilikan tiket di sini |
| REQUEST satu layanan | Baseline API `residency_letter` dan UI mock tersedia; SOP, riwayat detail, tool OpenClaw, dan integrasi nyata masih terbuka | Tautkan keputusan layanan, PR, dan uji approval di sini |
| Multi-desa | Struktur scope admin/channel tersedia; isolasi dua desa belum dibuktikan | Tautkan migrasi, PR, dan uji isolasi dua desa di sini |

**MVP demo siap** ketika REPORT, ASK, TRACK, REQUEST satu layanan, multi-desa,
dan kontrol dasar Definition of Done lulus pada lingkungan bersama, termasuk
happy path dan skenario adversarial/failure dalam PRD. Deteksi kemiripan
semantik dan analytics dasar dicatat sebagai SHOULD HAVE: lanjutkan setelah
alur serta izin inti stabil, dan tampilkan statusnya secara jujur saat demo.
**Deployment publik siap** setelah izin, privasi, kontrol lampiran yang dipakai,
manual fallback, dan isolasi data diuji pada API nyata. Keberhasilan dashboard
mock atau satu demo WhatsApp saja tidak memenuhi gerbang publik tersebut.
