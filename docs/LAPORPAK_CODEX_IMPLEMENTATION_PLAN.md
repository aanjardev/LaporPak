# LaporPak - Panduan Implementasi Agent Penerusan Laporan untuk Codex

> **Versi dokumen:** 1.0  
> **Disusun:** 21 September 2026  
> **Repository:** `aanjardev/LaporPak`  
> **Snapshot yang diperiksa:** `380b10028a50fcbd8e29f4c23d86fc95cafa3e77`  
> **Status:** spesifikasi pengembangan. Bukan bukti fitur telah diimplementasikan atau terhubung ke pemerintah.  
> **Fokus:** agent yang membantu penerusan dan tindak lanjut; bukan training/fine-tuning model.

---

## 0. Mulai dari sini

### Untuk pemilik proyek

Simpan file ini sebagai:

```text
docs/LAPORPAK_CODEX_IMPLEMENTATION_PLAN.md
```

Buka **repository aplikasi LaporPak**, bukan folder `laporpak_dataset_v0_1`. Jangan mengganti atau menimpa `AGENTS.md` yang sudah ada. File ini adalah spesifikasi tugas tambahan. Instruksi dan kontrak repository tetap harus dibaca. Codex mendukung instruksi proyek melalui `AGENTS.md`; dokumen panjang ini dipanggil secara eksplisit dalam tugas, bukan diasumsikan termuat otomatis. [S1]

Tempel instruksi berikut ke Codex untuk pekerjaan pertama:

```text
Baca AGENTS.md dan instruksi lokal yang berlaku, kemudian baca
docs/LAPORPAK_CODEX_IMPLEMENTATION_PLAN.md secara lengkap.

Kerjakan hanya M0 dan M1: audit singkat, kontrak penerusan, dan satu alur
backend lengkap dengan connector mock serta pengujian dua desa sintetis.
Jangan hanya mengembalikan rencana; implementasikan bagian yang dapat
berjalan lokal, jalankan pengujian, dan laporkan hasil sebenarnya.

Pertahankan OpenClaw/Gemini, FastAPI, Supabase PostgreSQL, dan dashboard
Next.js. Jangan melakukan training model atau mengganti stack.
Jangan mengirim laporan, notifikasi, atau data ke instansi nyata.
Jangan melakukan deployment, migrasi database bersama/produksi, push,
atau merge tanpa instruksi terpisah.

Kerjakan di feature branch. Pertahankan perubahan lokal pengguna.
Jika akses eksternal belum ada, gunakan fixture dan connector mock.
Jangan mengarang endpoint, credential, instansi, atau bukti registrasi.

Utamakan otorisasi per kasus/desa, paket yang disetujui, antrean persisten,
idempotensi, penanganan hasil pengiriman yang belum pasti, dan bukti.
Perbarui kontrak, dokumentasi, serta tes bersama perubahan kode.

Akhiri dengan daftar file berubah, perintah tes dan hasilnya,
bagian yang belum diuji, blocker eksternal, serta satu tugas berikutnya.
Jangan melanjutkan M2-M5 secara otomatis.
```

### Untuk Codex

Tujuan utama adalah **membuat langkah berikutnya benar-benar terlaksana dan dapat dibuktikan**. Jangan mengalihkan tugas ini ke pembuatan dataset, fine-tuning, atau penggantian framework AI.

M0-M1 adalah pekerjaan default pertama. M2-M5 merupakan roadmap dan tidak otomatis mengizinkan tindakan eksternal. Ketika ada kekurangan akses, lanjutkan pekerjaan lokal yang aman dan catat bagian yang terblokir. Jangan meminta credential untuk pekerjaan yang cukup diselesaikan menggunakan mock.

**Definisi MVP teknis:** kasus dari dua desa sintetis dapat dibuatkan paket, disetujui petugas uji yang berwenang, dikirim ke penerima mock, dicatat hasilnya, dan memperoleh tugas tindak lanjut bila ada hambatan. Mock selalu ditandai sebagai simulasi.

**Definisi pilot operasional:** alur yang sama berjalan melalui kanal yang diotorisasi, dengan bukti registrasi/penerimaan yang diakui penerima dan pengujian yang disepakati. Pilot operasional tidak dapat dinyatakan selesai hanya dari keberhasilan mock.

---

## 1. Tujuan produk dan keputusan arsitektur

### 1.1 Masalah yang diselesaikan

Laporan tidak boleh berhenti sebagai daftar tiket di dashboard atau status `forwarded` tanpa penerima yang jelas.

Alur target:

```text
Laporan warga
  -> Pemahaman dan klarifikasi
  -> Kandidat instansi + kanal + dasar rekomendasi
  -> Paket penerusan
  -> Otorisasi
  -> Pengiriman
  -> Verifikasi registrasi/penerimaan
  -> Tugas tindak lanjut
  -> Pembaruan ke warga
  -> Pemeriksaan hasil dan penutupan oleh pihak berwenang
```

Untuk setiap kasus terbuka, sistem harus menjawab: siapa PIC-nya, apa langkah berikutnya, kapan tenggatnya, apa bukti terakhir, dan apa hambatannya.

### 1.2 Keputusan yang digunakan

| Keputusan | Arahan implementasi |
|---|---|
| Tidak training model | Gunakan model yang sudah tersedia lewat integrasi Gemini/OpenClaw. |
| Satu alur agent terlebih dahulu | Jangan membangun banyak agent yang saling berdiskusi tanpa kebutuhan. |
| Backend memegang otoritas | Model mengusulkan tindakan; backend memeriksa izin dan menjalankannya. |
| Modular monolith | Tambahkan modul dan worker pada codebase yang ada; jangan membuat microservice AI baru. |
| Data persisten | Status kasus, tugas, persetujuan, dan pekerjaan tertunda disimpan di PostgreSQL. |
| Satu tiket warga | Referensi eksternal ditautkan ke laporan; jangan mengganti `reports` menjadi `tickets`. |
| Integrasi bertahap | Mulai dari mock; kanal nyata harus mempunyai kontrak dan otorisasi. |
| Multidesa sejak desain | Scope desa, identitas pengirim, dan izin tidak berasal dari output model. |
| Pekerjaan rutin tidak butuh LLM | Retry, deduplikasi, tenggat, dan status terstruktur ditangani kode deterministik. |

Ini memperluas produk yang ada, bukan menulis ulang seluruh aplikasi.

### 1.3 Batas janji produk

LaporPak dapat membantu memastikan pengiriman tercatat, bukti disimpan, dan tindak lanjut dipantau. Aplikasi tidak dapat menjamin tindakan lapangan instansi. Jangan menjanjikan penyelesaian atau tanggal selesai yang tidak dikonfirmasi sumber berwenang.

---

## 2. Konteks repository dan aturan membaca

### 2.1 Fakta yang sudah diperiksa

Pada snapshot di atas:

- `AGENTS.md` menetapkan OpenClaw sebagai pemanggil Gemini, FastAPI sebagai otoritas bisnis, dan larangan akses database/status langsung oleh AI. [R1]
- `AGENTS.md` menetapkan kategori/status REPORT canonical, kebutuhan foto pada create-report, serta perubahan kontrak yang harus didokumentasikan. [R1]
- `update_report_status()` pada `services/api/app/services/reports.py` memperbarui status dan riwayat. Pada fungsi tersebut, perubahan `forwarded` belum menjadi pengiriman eksternal. [R2]
- CI memeriksa backend, dashboard, dan plugin OpenClaw dengan perintah yang tercantum pada bagian pengujian dokumen ini. [R3]

Fakta ini merupakan pemeriksaan kode/dokumen, bukan hasil menjalankan aplikasi. Codex wajib membaca ulang HEAD lokal dan tidak mengasumsikan snapshot ini masih sama.

### 2.2 Urutan membaca sebelum mengedit

1. Instruksi global dan `AGENTS.md`/`AGENTS.override.md` yang berlaku untuk folder pekerjaan.
2. `docs/project-context.md`.
3. `docs/architecture.md`.
4. `docs/api-contract.md`.
5. `docs/workflows.md`.
6. `docs/development-rules.md`.
7. `docs/design-system.md` bila menyentuh UI.
8. `docs/mvp-delivery-plan.md`, `.github/workflows/ci.yml`, dan README modul yang diubah.
9. Implementasi nyata: schema, services, routes, repository database, migrations, tests, dan plugin OpenClaw terkait.

Catat SHA, branch, perubahan lokal, serta hasil baseline sebelum mengubah kode. Jangan mencetak isi `.env` atau secret dalam laporan.

### 2.3 Jika ada konflik

`AGENTS.md` mengatur cara kerja; kontrak canonical mengatur API dan status; arsitektur mengatur ownership. Dokumen ini tidak membolehkan mengabaikannya.

Perluasan fitur yang masih kompatibel boleh dikerjakan dengan pembaruan dokumen dan tes dalam perubahan yang sama. Konflik kewenangan, penghapusan guardrail, perubahan identitas pengaju, atau aktivasi pengiriman nyata harus dicatat dan menunggu keputusan pemilik proyek. Jangan menyelesaikan konflik dengan memperlebar izin.

---

## 3. Scope dan pekerjaan yang bukan prioritas

### 3.1 Scope MVP pengembangan

- Dua desa sintetis dengan admin dan pelapor uji terpisah.
- Satu instansi sintetis, satu connector mock, dan dua jenis kasus contoh.
- Direktori kandidat yang dikelola backend.
- Paket penerusan berversi; persetujuan eksplisit oleh petugas uji.
- Antrean pengiriman persisten, verifikasi hasil, serta event audit.
- Tugas dasar ketika pengiriman gagal atau belum pasti.
- Pembacaan progres oleh pemilik kasus tanpa kebocoran data desa lain.
- Integrasi agent dan UI secara bertahap setelah fondasi backend lulus.

Semua instansi, aturan, dan kasus fixture wajib diberi `synthetic=true` dan `approved_for_production=false`. Gunakan nama seperti `DESA_UJI_A`, bukan menampilkan fixture sebagai kewenangan pemerintah sungguhan.

### 3.2 Di luar scope default

Tidak melakukan training, GPU job, upload dataset publik, pengadaan layanan, pengiriman nyata, scraping portal pemerintah, otomasi CAPTCHA/OTP, browser agent bebas, n8n/Dify/Temporal/Kafka/Redis baru, maupun perubahan massal status lama.

Jangan menghapus dataset sebelumnya. Data tersebut dapat dijadikan kandidat skenario evaluasi setelah ditinjau, bukan dianggap data acuan yang sudah benar.

### 3.3 Pisahkan penanganan dari pelaporan

Model boleh menyarankan tujuan, bukan menentukan sah/tidaknya tuduhan. Model tidak menyetujui dirinya sendiri, tidak menutup laporan karena penerima berkata selesai, dan tidak menaikkan ke pusat hanya karena ada keterlambatan.

---

## 4. Invariant: aturan yang harus selalu benar

**I-01 - Identitas tepercaya.** Pengirim, scope desa, aktor, dan izin berasal dari autentikasi kanal/backend. Nomor tiket, session ID, atau `report_id` bukan bukti kepemilikan.

**I-02 - Tujuan terdaftar.** Agent hanya memilih ID kandidat yang diberikan backend. URL, alamat email, credential, dan desa operasional tidak boleh disisipkan oleh model atau teks laporan.

**I-03 - Otorisasi sebelum efek eksternal.** Pengiriman membutuhkan persetujuan sah atas paket tertentu atau mandat terbatas yang telah diaktifkan secara resmi. Default MVP hanya persetujuan eksplisit.

**I-04 - Paket tidak berubah diam-diam.** Otorisasi terikat pada versi/hash paket, tujuan, kanal, lampiran, identitas pengaju, dan klasifikasi kerahasiaan. Perubahan material membatalkan otorisasi versi lama.

**I-05 - Bukti sebelum klaim.** Transport terkirim, registrasi resmi, penerimaan penanganan, dan penyelesaian adalah fakta berbeda. Respons model/HTTP 200 saja bukan bukti registrasi.

**I-06 - Tidak menggandakan pengaduan tanpa alasan.** Retry mempertahankan identitas operasi. Timeout ambigu masuk rekonsiliasi sebelum pengiriman ulang yang berisiko duplikasi.

**I-07 - Setiap kasus terbuka mempunyai langkah berikutnya.** Ada PIC atau antrean yang memiliki PIC cadangan, tugas, dan tenggat yang mengikuti konfigurasi.

**I-08 - Scope tetap melekat pada kasus.** Jangan mengganti desa asal untuk memberi akses kepada dinas. Gunakan hak akses per kasus yang eksplisit bila fitur inbox instansi ditambahkan.

**I-09 - Tidak ada efek eksternal dari fixture.** Kanal mock tidak boleh memakai credential/live endpoint dan tidak boleh menghasilkan label registrasi pemerintah.

**I-10 - AI tidak menambah izin.** Prompt injection, dokumen sumber, lampiran, dan balasan penerima diperlakukan sebagai data tidak tepercaya, bukan instruksi operasional.

**I-11 - Tidak ada penutupan otomatis berdasarkan diam.** Tidak ada balasan admin bukan persetujuan; tidak ada balasan warga bukan kepuasan.

**I-12 - Hasil pengujian harus jujur.** Tes yang tidak dijalankan ditandai belum diuji. Mock bukan bukti integrasi resmi; tes aplikasi bukan otomatis bukti isolasi gateway.

---

## 5. Rancangan komponen dan alur kerja

```text
WhatsApp -> OpenClaw + Gemini
                 |
                 | Tools domain terbatas
                 v
             FastAPI
                 |
     +-----------+------------+
     |           |            |
 Routing     Otorisasi     Paket/version
     |           |            |
     +-----------+------------+
                 |
           PostgreSQL
       kasus + outbox + audit
                 |
          Worker persisten
                 |
         Connector terpilih
                 |
     Mock / kanal resmi berizin
                 |
       Receipt + status + tugas
                 |
   Dashboard / TRACK / notifikasi
```

Model dipakai untuk memahami, mengklarifikasi, menjelaskan kandidat, menyusun draf, dan menafsirkan informasi tidak terstruktur. Aplikasi mengeksekusi function call setelah validasi. [S2]

Jangan membuat pemanggilan Gemini kedua di FastAPI. Bila pekerjaan asinkron membutuhkan analisis AI, gunakan mekanisme pemanggilan gateway yang diautentikasi dan sudah disepakati. Periksa implementasi gateway repository sebelum memilih cara memicu analisis. Jika belum ada mekanisme, dokumentasikan perubahan arsitektur dan gunakan stub pengujian; jangan membuka endpoint gateway publik tanpa autentikasi.

LLM tidak perlu tetap hidup selama kasus menunggu beberapa hari. Event dan timer membangunkan langkah yang diperlukan; keadaan kasus tetap berada di database.

### 5.1 Intake dan routing

Simpan teks asli; pisahkan observasi, dugaan, dan informasi kurang. Bedakan desa asal kanal dari lokasi kejadian. Jangan mengisi koordinat, objek, atau dasar kewenangan dengan tebakan.

Backend menyaring kandidat memakai wilayah kejadian, jenis masalah, objek/aset jika relevan, sumber kewenangan, dan kesiapan kanal. AI memberi alasan dari kandidat tersebut. Sumber konflik/kedaluwarsa atau kandidat kosong menghasilkan review, bukan rute acak.

Pertahankan kategori REPORT canonical. Subkategori seperti `environment.water_pollution` menjadi metadata analisis yang berversi; jangan otomatis menambahkannya ke enum `ReportCategory` atau menyamakan seluruh pencemaran dengan `cleanliness`.

### 5.2 Paket dan pengaju

Paket memuat ringkasan, kronologi, lokasi, bukti terpilih, observasi/dugaan terpisah, tujuan, kanal, permintaan tindak lanjut, dan kontak minimum yang diizinkan.

Tetapkan apakah pengajuan dilakukan oleh warga, oleh pemdes, atau oleh pihak yang mendapat mandat. Jangan menganggap akun pemdes boleh mewakili seluruh warga secara otomatis. Konfirmasi warga atas isi laporan tidak sama dengan persetujuan administratif atau izin membagikan semua data.

### 5.3 Persetujuan dan tindak lanjut

Default: petugas berwenang menyetujui satu paket, lalu sistem otomatis menjalankan pekerjaan teknis. Jangan meminta petugas mengetik ulang paket ke setiap tahap.

Mandat pengiriman rutin tanpa review per kasus hanya disiapkan sebagai pengembangan M5, nonaktif secara default. Mandat harus mempunyai scope, penerbit berwenang, masa berlaku, batas data, pengecualian, audit, dan pencabutan.

Pengaduan terhadap pemdes sendiri tidak boleh bergantung hanya pada izin pihak terlapor. Sampai jalur independennya disepakati, tandai kasus sensitif untuk penanganan terbatas dan jangan memberikannya kepada pihak yang diadukan.

---

## 6. Status: jangan mencampur pengiriman dan penanganan

Nama field berikut adalah **kontrak usulan**, bukan fitur yang sudah ada. Dokumentasikan kontrak final sebelum implementasi.

### 6.1 Tiga dimensi referral

| Dimensi | Nilai usulan | Arti |
|---|---|---|
| `dispatch_status` | `draft`, `awaiting_approval`, `approved`, `queued`, `sending`, `sent`, `delivery_unknown`, `failed`, `cancelled` | Tahap penyiapan dan transport paket. |
| `registration_status` | `unverified`, `pending`, `registered`, `rejected` | Bukti tercatat di kanal penerima. |
| `handling_status` | `unassigned`, `awaiting_acceptance`, `accepted`, `in_progress`, `declined`, `completed` | Penerimaan dan pekerjaan oleh instansi. |

Backend menetapkan kombinasi/transisi yang sah. Pengiriman `sent` tidak otomatis mengubah registrasi menjadi `registered`. Nomor pesan email bukan nomor pengaduan. Instansi `declined` tidak otomatis membuat laporan warga `rejected`.

Alur utama transport:

```text
draft -> awaiting_approval -> approved -> queued -> sending -> sent
                                                |            |
                                                |            +-> registered, bila bukti ada
                                                +-> failed, bila pasti tidak terkirim
                                                +-> delivery_unknown, bila hasil belum pasti
```

Dari `delivery_unknown`: lakukan rekonsiliasi; ubah ke `sent` hanya dengan bukti, atau izinkan retry setelah terbukti belum tercatat / penerima menjamin idempotensi. Jika tidak dapat dipastikan, pertahankan status dan tugas manusia.

### 6.2 Hubungan dengan `reports.status`

Pertahankan enum REPORT yang sudah ada. Untuk MVP, mulai penerusan dari laporan yang telah masuk `in_progress` melalui transisi sah.

- Tahap paket/antrean tidak otomatis mengubah report menjadi `forwarded`.
- Dalam kontrak baru, `forwarded` hanya setelah `handling_status=accepted` dengan bukti yang diakui kanal/SOP. Registrasi tanpa penerimaan penanganan ditampilkan terpisah.
- Backend tetap otoritas atas perubahan status; terapkan perubahan proyeksi dan audit secara atomik dari hasil penerima yang sudah divalidasi.
- `completed` dari penerima tidak otomatis mengubah report menjadi `resolved`. Pemeriksaan bukti dan keputusan petugas mengikuti aturan penutupan.
- Penolakan/rujukan ulang membuat tugas dan referral yang sesuai. Jangan menambahkan transisi report baru secara diam-diam hanya karena state referral lebih rinci.

Endpoint umum perubahan status harus memeriksa syarat yang sama. Menyembunyikan tombol frontend saja tidak cukup. Jangan membiarkan `PATCH status=forwarded` menjadi jalur bypass.

### 6.3 Status lama dan pembatalan

Laporan lama berstatus `forwarded` tanpa bukti diberi penanda penerimaan belum terverifikasi; jangan mengarang bukti atau menulis ulang riwayatnya.

Sebelum side effect dimulai, pembatalan menghapus otorisasi pengiriman tertunda. Sesudah pengiriman dimulai, tampilkan status pembatalan yang belum dapat dipastikan dan rekonsiliasikan; jangan menjanjikan paket telah ditarik. Penarikan ke kanal luar adalah operasi baru yang membutuhkan dukungan kanal dan izin.

---

## 7. Direktori instansi dan kontrak connector

### 7.1 Direktori yang harus disiapkan

Gunakan struktur organisasi yang sudah ada bila sesuai, kemudian tambahkan profil kanal. Jangan membuat direktori kedua yang bersaing dengan `administrative_units` tanpa alasan.

Field minimum yang perlu dimodelkan:

```text
Identitas: target_unit_id, channel_id, nama, mode mock/live.
Cakupan: wilayah, jenis masalah, jenis objek, pengecualian.
Sumber: dokumen/URL, versi, tanggal review, reviewer, masa berlaku.
Kemampuan: submit, idempotency, lookup by reference, status polling,
            callback, attachment, cancellation, receipt semantics.
Operasional: PIC, PIC cadangan, aturan tenggat, status aktif.
Akses: konfigurasi server, referensi secret; bukan secret dalam prompt.
```

Pisahkan **instansi yang berwenang** dari **kanal yang mengantarkan laporan**. Satu kanal dapat melayani beberapa instansi. Ketersediaan portal publik bukan bukti akses API submit; untuk SP4N-LAPOR!, periksa kontrak integrasi dan otorisasi secara terpisah. [S5]

### 7.2 Antarmuka connector minimum

Buat antarmuka kecil sesuai kebutuhan, bukan framework integrasi umum.

```text
validate_package(package) -> hasil validasi dan field kurang
submit(package, operation_key) -> hasil transport dan receipt
lookup(operation_key / external_reference) -> hasil rekonsiliasi
fetch_status(external_reference) -> update terstruktur
```

Method yang tidak didukung wajib mengembalikan `unsupported`, bukan sukses kosong. Adapter memisahkan status HTTP, hasil bisnis, nomor registrasi, bukti penerimaan, dan waktu sumber.

Receipt minimum:

```text
channel_id
is_simulated
operation_key
transport_outcome
external_reference (nullable)
registration_outcome
handling_outcome
evidence_reference
occurred_at
observed_at
retry_classification
```

`external_reference` boleh null. Jangan membuat nomor eksternal sendiri kecuali connector mock dengan prefix `MOCK-` dan `is_simulated=true`. Di UI, nomor mock tidak boleh disebut nomor pengaduan resmi.

### 7.3 Perilaku mock yang wajib tersedia

Mock harus dapat mensimulasikan sukses transport saja, registrasi tertunda, penerimaan tugas, penolakan bisnis, credential gagal, throttling, timeout sebelum menerima, timeout setelah menerima, callback ganda, dan update terlambat.

Untuk tes yang mengklaim tahan restart, simpan ledger penerima mock secara persisten pada database uji atau proses penerima uji terpisah. Mock in-memory saja tidak membuktikan kasus crash/restart.

---

## 8. Model data minimum dan perubahan database

Nama berikut usulan. Gunakan kembali tabel/helper yang sudah memenuhi kebutuhan. Migration harus baru dan bernomor setelah migration terakhir; jangan mengedit migration yang telah digunakan.

| Entitas | Tanggung jawab dan field inti |
|---|---|
| Direktori/`agency_channels` | Target unit, capability, mode, sumber, konfigurasi server, status aktif. |
| `report_referrals` | `report_id`, desa asal, target, channel, versi paket aktif, tiga dimensi status, referensi eksternal. |
| `referral_packages` | Snapshot immutable isi, attachment reference+hash, scope berbagi, pengaju, package version+hash, jejak persetujuan/revokasi. |
| `referral_events` | Riwayat append-only: actor, sumber, event type, before/after, waktu sumber/observasi, dedup key, referensi bukti. |
| `outbox_events` | Job persisten: operation key, referral/package, status, attempt, next attempt, lease/fencing token, batas retry, hasil. |
| `case_tasks` | PIC/antrean, jenis tugas, next action, due time, alasan hambatan, status, hasil. |

Simpan proposal AI sebagai data terpisah dari keputusan. Metadata minimal: model/prompt version, kandidat/sumber yang dipakai, waktu, hasil validasi, dan alasan override manusia.

Constraints yang diperlukan:

- Foreign key menjaga hubungan laporan, referral, paket, dan kanal.
- Unik untuk `(referral_id, package_version)`.
- Otorisasi menunjuk tepat satu hash/versi paket dan principal pemberi izin.
- Operation key unik untuk satu submit logis; retry tidak menciptakan operasi baru.
- Duplikasi permintaan pembuatan referral ditangani dengan request key dan pemeriksaan intent pengiriman aktif; bukan hanya UUID acak baru.
- External event unik menurut kanal dan ID event jika tersedia. Pemetaan referensi eksternal juga mempertimbangkan kanal.
- Tugas reminder/rekonsiliasi mempunyai dedup key agar scheduler berulang tidak menambah tugas identik.

Untuk M1, approval dapat disimpan terstruktur pada versi paket dengan event audit; tidak wajib membuat policy engine atau tabel approval generik. Untuk fase berikutnya, pisahkan bila kebutuhan nyata menuntutnya.

Bukti dan data pribadi disimpan privat. Gunakan API yang memeriksa izin, bukan URL publik permanen. Batas retensi, akses support, serta penghapusan mengikuti kebijakan yang disahkan; jangan menetapkan retensi tanpa keputusan.

---

## 9. API aplikasi dan tools agent

### 9.1 Endpoint aplikasi usulan

Semua route berikut **belum dinyatakan ada**. Sesuaikan dengan gaya repo dan dokumentasikan payload/error sebelum implementasi.

| Endpoint usulan | Pelaku yang boleh | Hasil |
|---|---|---|
| `GET /api/v1/reports/{id}/routing-options` | Operator berwenang; tool AI dengan scope terbatas bila disetujui. | Kandidat dan sumber yang boleh dilihat. |
| `POST /api/v1/reports/{id}/referrals` | Operator; tool AI hanya membuat draft dengan izin terbatas. | Draft referral, bukan pengiriman. |
| `GET /api/v1/reports/{id}/referrals` | Pemilik scope kasus; respons warga harus disaring. | Daftar progres dan bukti yang diizinkan. |
| `POST /api/v1/referrals/{id}/approve` | Petugas berwenang, bukan model/API key warga. | Otorisasi package hash tertentu. |
| `POST /api/v1/referrals/{id}/dispatch` | Workflow/service berizin atau operator. | Job tersimpan; bukan klaim kasus sudah terdaftar. |
| `POST /api/v1/referrals/{id}/reconcile` | Worker/operator yang berwenang. | Pemeriksaan hasil, bukan submit ulang sembarangan. |
| `POST /api/v1/referrals/{id}/cancel` | Operator berwenang. | Pembatalan antrean bila side effect belum dimulai. |

Callback penerima, bila didukung, menggunakan route tersendiri dengan autentikasi/signature, replay protection, dan pemetaan target di server. Jangan mempercayai `tenant_id` atau `report_id` dari payload callback begitu saja.

`dispatch` dapat mengembalikan HTTP 202 setelah transaksi tersimpan. Replay harus konsisten. Paket berubah atau status konflik menghasilkan 409; payload salah 422; tidak berwenang 403 atau 404 sesuai kebijakan non-disclosure repo. Tetapkan kode error final di kontrak, bukan menebaknya di frontend.

### 9.2 Tools agent yang diizinkan

| Tool usulan | Fungsi |
|---|---|
| `get_case_context` | Membaca konteks kasus yang sudah dibatasi backend. |
| `get_routing_candidates` | Kandidat instansi, kanal, dan sumber yang relevan. |
| `prepare_referral` | Draf paket dengan field terstruktur. |
| `request_dispatch` | Meminta backend memeriksa otorisasi dan mengantrekan paket. |
| `get_referral_progress` | Status/bukti terakhir, bukan tebakan progres. |
| `propose_follow_up` | Usulan klarifikasi/tugas; tindakan keluar tetap diperiksa backend. |

Jangan memberikan tool `approve` kepada agent. Pisahkan tools percakapan warga, tools operator, dan capability worker. Satu API key dengan akses semua desa tidak boleh menjadi dasar otorisasi per kasus.

Argumen model cukup ID kasus yang sedang terikat pada konteks tepercaya dan isi proposal. Model tidak mengisi actor identifier, secret, approved flag, sender identity, atau destination URL. Metadata autentikasi disuntikkan oleh runtime tepercaya dan diverifikasi backend.

### 9.3 Aturan respons agent

Agent hanya menyatakan tahapan yang dibuktikan tool result. Ketika tool gagal atau akses ditolak, jangan menyimpulkan apakah tiket orang lain ada. Jangan mengulang side effect hanya karena respons percakapan hilang.

Batas loop, timeout, dan anggaran per kasus harus dapat dikonfigurasi. Jika klarifikasi/pencarian berulang tidak menyelesaikan masalah, buat handoff dengan alasan. Jangan memaksa keputusan hanya untuk menyelesaikan percakapan.

---

## 10. Workflow persisten, retry, dan rekonsiliasi

Pola transactional outbox digunakan untuk menyimpan perubahan data dan pekerjaan keluar dalam satu transaksi. Pola tersebut tetap membutuhkan idempotensi karena pengiriman ulang dapat terjadi. [S3]

### 10.1 Urutan submit yang harus diterapkan

1. Lock kasus/referral yang relevan; validasi scope, state, versi paket, dan otorisasi.
2. Cek duplikasi operasi, kanal aktif, fitur aktif, serta batas tindakan.
3. Dalam satu transaksi: simpan event otorisasi/dispatch dan outbox job. Commit.
4. Worker mengklaim job dengan lease/fencing token dalam transaksi singkat.
5. Sesaat sebelum side effect: periksa kembali pembatalan, otorisasi, expiry, package hash, dan kill switch. Tandai dispatch mulai secara atomik.
6. Lakukan HTTP/transport di luar transaksi database yang panjang. Gunakan operation key yang sama pada retry.
7. Simpan hasil dan event audit dalam transaksi; buat tugas rekonsiliasi bila hasil tidak pasti.
8. Notifikasi/proyeksi status dibuat dari hasil yang sudah tersimpan, bukan dari rencana model.

Saat worker crash setelah dispatch mulai, jangan langsung mengirim ulang ketika lease habis. Perlakukan hasil sebagai belum diketahui, lalu gunakan lookup/idempotensi penerima untuk pemulihan. Fencing token mencegah worker lama menimpa hasil baru; token lokal tidak menjamin satu pengiriman di sistem penerima.

### 10.2 Klasifikasi kegagalan

| Kondisi | Tindakan |
|---|---|
| Validasi paket gagal | Jangan submit; buat klarifikasi/review. |
| 401/403 kanal | Hentikan retry otomatis; alert konfigurasi/otorisasi. |
| 429/layanan sementara | Backoff terbatas dan hormati arahan retry kanal; pertahankan operation key. |
| 5xx/timeout sesudah request mungkin diterima | Hasil ambigu; cek kontrak kanal dan rekonsiliasi, bukan blind retry. |
| Bukti bahwa belum terkirim | Retry terbatas bila aman. |
| Penolakan kewenangan | Tugas routing ulang, bukan retry paket identik. |
| Batas percobaan tercapai | Antrean gagal + PIC; tidak boleh hilang di log. |

Jika penerima tidak mendukung idempotensi atau pencarian referensi, jangan mengklaim jaminan exactly-once. Setelah timeout ambigu, minta verifikasi melalui jalur operasional yang disepakati sebelum mencoba kembali.

### 10.3 Konkurensi dan perubahan setelah approval

Dua klik/worker bersamaan harus mengarah ke operasi yang sama atau konflik yang aman. Perubahan paket membuat versi baru, bukan mengedit versi yang sedang dikirim. Periksa izin setelah antrean menunggu lama; persetujuan yang telah dicabut tidak berlaku kembali karena job lama hidup lagi.

Ketika side effect sudah dimulai sebelum pembatalan, laporkan keterbatasan itu. Jangan menulis `cancelled` seolah laporan pasti belum terkirim.

### 10.4 Event terlambat

Simpan payload eksternal minimum, waktu sumber, dan waktu observasi. Gunakan urutan/event version resmi bila tersedia. Timestamp saja tidak selalu cukup; konflik masuk rekonsiliasi. Jangan membuang bukti lama, tetapi jangan membiarkannya menurunkan proyeksi progres secara sembarangan.

---

## 11. Keamanan multidesa dan batas OpenClaw

### 11.1 Kontrol aplikasi

Uji isolasi pada detail laporan, daftar, pencarian, attachment, paket, retrieval, cache, status, callback, dan worker. Query harus memeriksa relasi kepemilikan/izin, bukan sekadar menerima ID dari model.

- Kanal desa dan metadata pengirim harus terikat pada ingress terautentikasi; jangan percaya header buatan client tanpa verifikasi.
- Worker memperoleh scope dari outbox/referral yang tervalidasi, bukan field bebas dalam message body.
- Cache dan idempotensi mempertimbangkan identitas operasi serta scope; jangan berbagi hasil privat lintas desa.
- `system_admin` bukan jalan pintas untuk membaca semua laporan; pertahankan batas role yang berlaku.
- Instansi yang menangani beberapa desa tetap hanya memperoleh kasus yang diberikan kepadanya.
- Identitas warga dapat dibagikan hanya sesuai kebutuhan dan otorisasi, bukan karena target adalah organisasi pemerintah.

### 11.2 Batas gateway

Dokumentasi OpenClaw memperingatkan bahwa gateway bukan batas keamanan untuk pengguna yang saling tidak tepercaya; session ID tidak setara dengan otorisasi. [S4]

Untuk publik multidesa, jangan menyimpulkan satu gateway bersama aman hanya karena tiap warga mempunyai session key. Pisahkan batas kepercayaan/gateway dan credential sesuai model deployment, serta batasi tools lintas sesi, filesystem, shell, browser, dan pengiriman pesan umum. Backend tetap harus membatasi setiap operasi warga.

Gateway per desa juga tidak otomatis mengisolasi warga dalam desa yang sama. Sampai sandbox/context/tool isolation terbukti sesuai threat model, pertahankan pengujian sintetis/internal dan jangan aktifkan multiuser publik. Bila perlu perubahan deployment, tulis keputusan arsitektur terpisah; jangan menganggap seluruh isolasi selesai melalui patch FastAPI.

### 11.3 Perlindungan isi dan koneksi

Alamat jaringan hanya dari konfigurasi yang disetujui; validasi tujuan dan redirect untuk mencegah SSRF. Jangan fetch URL attachment warga secara bebas. Batasi ukuran/jenis file, akses privat, dan umur akses; lakukan pemeriksaan keamanan lampiran sesuai kebutuhan sebelum kanal nyata.

Jangan menulis raw token, nomor telepon, isi aduan sensitif, atau full payload ke log umum. Audit merekam alasan keputusan tanpa menyimpan hidden chain of thought. Gunakan ringkasan alasan singkat dan referensi sumber.

---

## 12. Dashboard, TRACK, dan tugas tindak lanjut

### 12.1 Tampilan operator yang perlu dibuat pada M3

Tambahkan panel pada detail laporan, bukan dashboard baru yang menduplikasi semuanya:

- Kandidat tujuan, sumber, dan informasi yang belum lengkap.
- Pratinjau paket, pilihan lampiran, scope data, dan identitas pengaju.
- Persetujuan yang menyebut versi/hash paket.
- Timeline pengiriman, registrasi, penerimaan, serta sumber bukti.
- PIC, langkah berikutnya, tenggat, hambatan, dan aksi rekonsiliasi.

Frontend hanya menampilkan aksi yang diizinkan respons backend. Periksa konflik 409, perubahan versi, akses dicabut, penyimpanan berhasil tetapi reload gagal, dan submit berulang. Ikuti design system repo.

### 12.2 Bahasa status warga

Gunakan template yang bersumber dari data persisten, misalnya:

```text
Menunggu pemeriksaan paket oleh petugas.
Paket telah dikirim; registrasi belum terkonfirmasi.
Laporan terdaftar pada kanal penerima dengan referensi yang ditampilkan.
Instansi menerima laporan untuk penanganan.
Instansi meminta informasi tambahan berikut.
Hasil pengiriman belum dapat dipastikan; sedang diperiksa petugas.
```

Tampilkan waktu pembaruan dan tanda simulasi bila berlaku. Jangan menggunakan nomor mock dalam template yang menyatakan laporan resmi.

Notifikasi proaktif memerlukan dukungan dan izin kanal, opt-in serta template bila diwajibkan penyedia. Verifikasi kebijakan WhatsApp/provider yang benar-benar digunakan saat implementasi; jangan menganggap semua pesan bebas dikirim. Dalam M1, notifikasi cukup event/outbox sink lokal, bukan pesan nyata.

### 12.3 Tenggat dan eskalasi

Pisahkan tenggat approval, registrasi, penerimaan, update progres, dan target penyelesaian. Gunakan konfigurasi kanal/SOP, kalender kerja, serta zona waktu yang benar. Simpan timestamp konsisten; tampilan dapat memakai zona waktu desa. Jangan menetapkan tenggat hukum atau janji layanan dari tebakan.

Setiap reminder/escalation memiliki dedup key. Eskalasi berarti tugas/pemberitahuan kepada pihak yang sudah dikonfigurasi, bukan otomatis membuat pengaduan baru ke pusat. Riwayat due date dan pause reason disimpan untuk mencegah penghilangan keterlambatan melalui reset tenggat.

Jika feedback warga negatif, buat tugas review tanpa mengarang bahwa status resmi sudah dibuka kembali. Perubahan status mengikuti transisi dan kewenangan yang disetujui.

---

## 13. Roadmap eksekusi: satu milestone per pekerjaan

### M0 - Audit singkat dan kontrak perubahan

**Tujuan:** memastikan rencana sesuai codebase tanpa mengulang discovery berkepanjangan.

Pekerjaan:

1. Baca instruksi, cek branch/SHA/working tree, dan jalankan baseline yang memungkinkan.
2. Petakan reuse tabel/helper, auth, plugin, gateway, dokumentasi, dan tes.
3. Buat catatan keputusan arsitektur singkat untuk referral, status, otorisasi, dan worker.
4. Dokumentasikan perubahan kontrak sebelum/bersama kode. Catat konflik atau dependency nyata.

**Output:** peta perubahan, kontrak usulan yang konsisten, hasil baseline, dan scope M1. Jangan berhenti dengan rencana saja bila M1 dapat dikerjakan lokal.

### M1 - Backend penerusan lengkap dengan mock

**Tujuan:** satu alur backend yang dapat diuji dari paket sampai bukti, tanpa layanan eksternal.

Pekerjaan:

1. Tambahkan migration minimal, schema, services, dan routes referral beserta scope desa.
2. Gunakan fixture dua desa, admin/pelapor terpisah, satu instansi/kanal mock, dan kandidat aturan sederhana yang deterministik.
3. Implementasikan draft, versi paket, approval, dispatch idempotent, worker/outbox, receipt, dan tugas hambatan.
4. Implementasikan guard terhadap bypass status `forwarded` dan representasi status legacy yang belum terverifikasi.
5. Sediakan mock connector serta skenario timeout-after-accept dan restart yang dapat direproduksi.
6. Tambahkan demo runnable lokal dan integration tests; jangan mengharuskan akses Gemini atau pemerintah.

**Batas:** belum menambah agent tools live, UI besar, policy-authorized dispatch, atau connector pemerintah. API dapat diuji menggunakan fixtures/test client. UI lama yang bisa melewati aturan baru harus disesuaikan minimal atau menampilkan aksi tidak tersedia dengan alasan.

**Selesai bila:** data persisten terbukti pada PostgreSQL uji, akses desa lain ditolak, approval versi lama tidak bisa dipakai, receipt mock jujur, retry/rekonsiliasi bekerja, dan tidak ada network request ke kanal nyata. Bila database uji tidak tersedia, tandai bagian ini belum terbukti meski unit test lulus.

### M2 - Integrasi agent dan evaluasi perilaku

**Prasyarat:** M1 lulus.

Tambahkan tools terbatas, schema output, prompt rekomendasi/penyiapan paket, serta alur clarification. Pertahankan Gemini hanya pada jalur OpenClaw yang disepakati. Buat evaluasi tool selection dan keselamatan, termasuk prompt injection, kandidat kosong, salah desa, dan output salah.

Agent boleh membuat draf serta meminta dispatch; backend tetap menolak tanpa approval. Tes stub dan replay terpisah dari uji model nyata. Jika credential Gemini belum tersedia, jalankan tes stub dan nyatakan live model evaluation belum dilakukan.

**Selesai bila:** agent menghasilkan rencana dan tool call yang benar tanpa akses status/admin bebas. Ukur hasil aktual; jangan menetapkan lulus hanya dari satu percakapan demo.

### M3 - Review UI, TRACK, dan pengelolaan kasus tertahan

**Prasyarat:** kontrak M1-M2 stabil.

Tambahkan panel paket/persetujuan/timeline, antrean tugas, due date, serta respons TRACK yang disaring untuk warga. Scheduler membuat reminder dan tugas rekonsiliasi tanpa duplikasi. Notifikasi tetap mock sampai kanal keluar diotorisasi.

**Selesai bila:** petugas mengetahui apa yang harus dikerjakan berikutnya, dan warga hanya melihat progres yang didukung bukti. Uji auth, tampilan error, notifikasi ganda, dan feedback negatif.

### M4 - Satu connector resmi dalam pilot berizin

**Prasyarat:** checklist aktivasi pada bagian 17 lengkap.

Implementasikan adapter berdasarkan dokumentasi resmi yang benar-benar tersedia. Jalankan contract test di sandbox/kanal uji yang disetujui penerima. Setelah itu, aktifkan terbatas pada dua desa pilot sesuai izin, dengan volume dibatasi dan kill switch aktif.

**Selesai bila:** ada bukti registrasi/penerimaan dari sistem mitra, bukan dari mock. Tandai kemampuan yang masih manual, misalnya status tidak dapat diambil otomatis.

Tanpa akses resmi, output tahap ini adalah adapter skeleton + mock contract tests + daftar kebutuhan. Jangan mengarang endpoint atau menyebut integrasi sudah selesai.

### M5 - Otomasi berbasis mandat dan perluasan

**Prasyarat:** pilot, evaluasi kegagalan, dan persetujuan tata kelola.

Tambahkan mandat terbatas untuk kasus rutin. Review manusia tetap berlaku pada pengecualian. Tambahkan pemeriksaan expiry/revocation, pembatasan tujuan/data, audit penerbit mandat, dan penghentian per desa/kanal.

Jangan membangun policy engine kompleks bila kebutuhan cukup dipenuhi aturan terbatas yang eksplisit. Perluasan ke instansi lain membutuhkan contract test baru dan validasi kewenangan, bukan menyalin konfigurasi tanpa review.

---

## 14. Peta perubahan kode

Path berikut adalah arah penempatan, bukan daftar file yang semuanya wajib dibuat. Cocokkan dengan struktur aktual dan pilih implementasi terkecil.

| Area | Arah perubahan |
|---|---|
| `services/api/app/schemas/` | Kontrak referral, paket, approval, receipt, tugas, dan respons publik. |
| `services/api/app/services/` | Routing kandidat, lifecycle referral, otorisasi dispatch, rekonsiliasi. |
| `services/api/app/db/` | Table/repository baru, queries scoped, locks, dedup, transaksi. |
| `services/api/app/api/routes/` | Endpoint referral dan callback bila dibutuhkan. |
| `services/api/app/core/security.py` | Reuse auth; perluasan capability terbatas tanpa memperlebar role. |
| `services/api/app/services/reports.py` | Guard status dan proyeksi referral ke REPORT. |
| `services/api/app/services/citizen.py` | TRACK dari sumber resmi dan redaksi field. |
| `database/migrations/` | Migration baru yang kompatibel; nomor ditentukan dari repo. |
| `database/seeds/` atau fixtures tes | Data uji sintetis, tidak diaktifkan pada produksi. |
| `integrations/openclaw/` | Prompt, schema, tools, dan evaluasi; mulai M2. |
| `apps/dashboard/` | Panel/referral/tugas mengikuti design system; utama M3. |
| `services/api/tests/` dan tes modul terkait | Unit, API/auth, DB integration, worker, contract connector. |
| `docs/` | Kontrak, arsitektur, workflow, runbook, hasil pengujian, blocker. |

Lokasi modul worker dan entrypoint dipilih berdasarkan konvensi repo. Worker boleh proses terpisah dari codebase yang sama; ini bukan alasan membuat microservice baru. Tulis cara menjalankannya untuk PowerShell dan CI setelah entrypoint nyata dibuat.

Jangan membuat migration produksi pada saat penyusunan plan. Jangan membuat file `AGENTS.md` baru untuk mengganti aturan yang menghambat; selesaikan konflik secara eksplisit.

---

## 15. Matriks pengujian wajib

Semua baris di bawah adalah **kriteria yang belum dijalankan oleh dokumen ini**. Catat status `passed`, `failed`, `not_run`, atau `blocked` beserta buktinya. Jangan menyamakan semua jenis tes.

| ID | Skenario | Hasil yang harus terjadi |
|---|---|---|
| T01 | Alur lengkap dengan mock | Draft -> approval -> job -> receipt -> tugas/progres dengan label simulasi. |
| T02 | Admin Desa A membaca/mengubah kasus Desa B | Ditolak; tidak membocorkan detail atau lampiran. |
| T03 | Warga menebak nomor tiket orang lain | Ditolak sesuai non-disclosure policy. |
| T04 | Model mengirim `tenant_id`, actor, approved flag, atau URL palsu | Diabaikan/ditolak; konteks server tidak berubah. |
| T05 | Kandidat instansi kosong, tidak aktif, atau di luar cakupan | Review/clarification; tidak ada dispatch. |
| T06 | Sumber kewenangan kedaluwarsa/bertentangan | Tidak mengarang rute; jelaskan kebutuhan review. |
| T07 | Agent mencoba memanggil approval | Tidak tersedia atau ditolak server. |
| T08 | Dispatch tanpa approval | Tidak ada job kirim dan tidak ada efek eksternal. |
| T09 | Paket diubah setelah approval | Approval lama tidak berlaku; perlu review versi baru. |
| T10 | Approval dicabut/kedaluwarsa saat antrean menunggu | Worker tidak mengirim. |
| T11 | Dua klik atau dua worker bersamaan | Satu operasi logis; tidak ada kirim ganda yang tidak direkonsiliasi. |
| T12 | Timeout setelah penerima mock mencatat kasus | Masuk `delivery_unknown`; lookup menemukan referensi yang sama. |
| T13 | Proses mati sesudah dispatch mulai | Restart tidak melakukan blind resend. |
| T14 | Provider tidak punya idempotensi/lookup | Hasil ambigu tetap pending reconciliation dengan PIC. |
| T15 | HTTP 200 atau email sent tanpa registrasi | Tidak mengklaim `registered`/`accepted`. |
| T16 | ID event callback berulang | Satu event efektif; tugas/notifikasi tidak berlipat. |
| T17 | Callback palsu, replay, atau referensi kanal lain | Ditolak; scope tidak dapat dipindahkan oleh payload. |
| T18 | Update terlambat atau bertentangan | Audit tersimpan; proyeksi tidak mundur tanpa rekonsiliasi. |
| T19 | Penolakan kewenangan | Buat tugas rerouting; kasus warga tidak otomatis ditolak/selesai. |
| T20 | Kanal gagal sampai batas retry | Job masuk antrean gagal dan tugas PIC; tidak hilang. |
| T21 | PATCH langsung ke `forwarded` tanpa penerimaan sah | Ditolak oleh backend, termasuk tanpa UI. |
| T22 | Report lama `forwarded` tanpa bukti | Ditampilkan belum terverifikasi; riwayat tidak direkayasa. |
| T23 | Penerima mengatakan selesai | Tidak otomatis `resolved`; pemeriksaan dan otorisasi tetap berlaku. |
| T24 | Feedback warga menyatakan masalah belum selesai | Tugas review dibuat satu kali; tidak mengklaim sudah selesai. |
| T25 | Approval/reminder tidak direspons | PIC cadangan/tugas sesuai SOP; tidak auto-approve. |
| T26 | Kill switch aktif / pembatalan sebelum dispatch | Job baru tidak dikirim; job dalam penerbangan ditangani jujur. |
| T27 | Prompt injection di teks, lampiran, sumber, atau balasan | Tidak memperoleh tools/izin/tujuan baru. |
| T28 | Cache, retrieval, sesi, dan attachment lintas desa | Tidak ada hasil privat silang. Uji gateway tersendiri. |
| T29 | PII/secret dalam log atau output model | Tidak tersimpan/terpapar di saluran yang tidak diizinkan. |
| T30 | Mock mode atau fixture dinyalakan pada konfigurasi live | Ditolak atau tetap berlabel simulasi; tidak ada pengiriman pemerintah. |

M1 harus membuktikan test backend relevan, terutama T01-T04, T08-T16, T20-T22, T26, dan T30. M2-M3 menambah perilaku model, sesi, notifikasi, dan UI. T17 berlaku ketika callback diimplementasikan. Beri alasan bila belum applicable, bukan langsung menandainya lulus.

Gunakan PostgreSQL terisolasi untuk membuktikan migration, locks, transaksi, serta restart. SQLite/mocks tidak membuktikan perilaku PostgreSQL. Gunakan controllable clock pada tes due date, bukan sleep panjang.

---

## 16. Perintah pengujian dan bukti hasil

Perintah berikut bersumber dari CI snapshot yang diperiksa. [R3] Baca ulang package scripts dan dependency lock sebelum menjalankan; jangan menyalin runtime dari folder dataset training ke aplikasi.

Contoh dari root repository menggunakan PowerShell:

```powershell
Push-Location services/api
uv sync --frozen
uv run ruff check .
uv run pytest
Pop-Location

Push-Location apps/dashboard
npm ci
npm run test:reports
npm run test:knowledge
npm run test:requests
npm run test:auth
npm run lint
npm run build
Pop-Location

Push-Location integrations/openclaw/plugins/laporpak-tools
npm test
Pop-Location
```

Jalankan kelompok yang relevan dan regression checks lintas kontrak. Jika dependency berubah dengan alasan yang disetujui, perbarui lockfile dan catat perubahan; jangan memaksa `--frozen` untuk mengabaikan ketidaksesuaian.

Tes integrasi baru harus mempunyai command yang terdokumentasi, URL database khusus tes, fixture terkontrol, dan cleanup yang aman. Jangan memakai database shared development/produksi atau credential yang kebetulan tersedia tanpa otorisasi.

Untuk setiap perintah, catat direktori, exit code, jumlah tes bila tersedia, dan alasan blocked/skipped. Baseline failure dipisahkan dari regresi perubahan. Jika database/gateway tidak tersedia, laporkan batas pembuktian; jangan menulis "semua tes lulus".

### Definition of Done perubahan kode

- [ ] Scope milestone yang diminta selesai atau bagian blocked dijelaskan.
- [ ] Kontrak, schema, migration, mock, dan implementasi konsisten.
- [ ] Izin diperiksa server-side pada setiap operasi sensitif.
- [ ] Tes positif, negatif, konkurensi, dan kegagalan relevan dijalankan.
- [ ] Tidak ada secret/data warga nyata dalam diff, fixture, atau log.
- [ ] Tidak ada pengiriman nyata atau migration produksi tanpa izin.
- [ ] Cara menjalankan worker/demo/test terdokumentasi.
- [ ] Perubahan lokal pengguna tetap utuh.
- [ ] Fitur yang belum tersedia ditulis eksplisit, bukan ditutupi stub sukses.

---

## 17. Checklist sebelum mengaktifkan kanal nyata

Ini gerbang M4, bukan syarat untuk mulai coding mock. Tidak satu pun dianggap selesai hanya karena dokumentasi ini tersedia.

| Kebutuhan | Penanggung jawab yang perlu ditunjuk | Bukti |
|---|---|---|
| Instansi, cakupan, dan sumber kewenangan | Pemilik SOP/mitra | Sumber aktif dan hasil review. |
| Identitas pengaju dan mandat | Pemdes/pengelola pengaduan | Keputusan siapa bertindak atas nama siapa. |
| Hak berbagi data dan kerahasiaan | Pemilik data/petugas berwenang | Aturan field, lampiran, retensi, dan informasi kepada warga. |
| Kanal dan izin integrasi | Pengelola kanal | Dokumentasi, akun institusi, scope akses. |
| Sandbox/prosedur uji | Tim dan penerima | Rencana uji yang tidak menghasilkan aduan fiktif produksi. |
| Receipt dan semantik status | Pengelola kanal | Definisi terkirim, terdaftar, diterima, dan selesai. |
| Idempotensi dan rekonsiliasi | Backend + penerima | Kontrak retry/lookup dan skenario timeout. |
| PIC, pengganti, serta tenggat | Pemdes + penerima | Jalur penanganan dan eskalasi yang disepakati. |
| Keamanan multidesa/gateway | Engineer + peninjau keamanan | Hasil tes dan batas kepercayaan deployment. |
| Notifikasi keluar | Pengelola kanal komunikasi | Izin, template, dan batas provider. |
| Recovery, kill switch, dan audit | Operator sistem | Runbook dan uji pemulihan. |

Seluruh secret dipasang melalui mekanisme server yang disetujui, bukan ditempel ke dokumen atau prompt. Persetujuan untuk mengembangkan kode tidak sama dengan izin mengirim data warga ke pihak luar.

---

## 18. Pengukuran, rollout, dan pemeliharaan

### 18.1 Metrik utama

Ukur jumlah pengiriman yang diotorisasi, transport berhasil, registrasi terverifikasi, penerimaan tugas, hasil ambigu, salah rute, operasi duplikat, serta kasus tanpa PIC/next action. Ukur durasi per tahap, bukan hanya total waktu sampai selesai.

Hitung keberhasilan registrasi dari pengajuan berizin ke kanal yang mendukung registrasi dan tampilkan denominator. Email sent tanpa registrasi tidak masuk hitungan sukses registrasi. Pisahkan angka mock, sandbox, dan produksi.

Untuk agent, ukur pemilihan tool, kelengkapan yang dihitung backend, kesetiaan fakta, ketepatan sumber, pelanggaran izin yang diblokir, kebutuhan override, latency, dan biaya. Jangan memakai accuracy kategori sebagai satu-satunya ukuran.

### 18.2 Rollout bertahap

Urutan: local mock -> staging terisolasi -> uji mitra berizin -> pilot terbatas -> perluasan. Mulai dalam mode draft/shadow untuk analisis; kemudian aktifkan approved dispatch. Mandat rutin hanya M5.

Sediakan pengaktifan per desa/kanal dan kill switch global. Penghentian menghentikan pekerjaan baru, mempertahankan audit, dan menandai pekerjaan yang mungkin sudah terkirim untuk rekonsiliasi. Rollback kode tidak boleh menghapus bukti atau mengulangi submit lama.

### 18.3 Pemeliharaan yang harus punya pemilik

Tetapkan penanggung jawab pembaruan direktori, review sumber, rotasi credential, perubahan kontrak penerima, aturan tenggat, dan tindak lanjut antrean gagal. Dataset evaluasi berasal dari kasus sintetis yang ditinjau dan kasus nyata yang boleh digunakan, bukan otomatis dari seluruh laporan warga.

---

## 19. Prompt lanjutan dan format serah terima Codex

### 19.1 Setelah M1 selesai

Gunakan instruksi berikut hanya setelah memeriksa laporan hasil M1:

```text
Lanjutkan M2 pada docs/LAPORPAK_CODEX_IMPLEMENTATION_PLAN.md.
Baca catatan hasil M1 dan jalankan pemeriksaan regresi yang relevan.
Integrasikan tools agent yang terbatas dan evaluasi perilakunya.
Pertahankan connector mock dan persetujuan server-side.
Jangan membuka tool approval untuk AI dan jangan mengaktifkan kanal nyata.
Pisahkan hasil tes stub dari evaluasi model langsung.
Laporkan perubahan, hasil tes, batas pengujian, dan blocker.
```

Untuk fase lain, sebutkan nomor milestone dan kanal/environment yang memang diizinkan. Jangan memberikan instruksi ambigu seperti "kerjakan semuanya sampai otomatis" bila akses dan batas tindakannya belum ditetapkan.

### 19.2 Format laporan akhir yang wajib dibuat Codex

```text
Milestone dan cakupan yang dikerjakan:
Branch dan commit dasar:

Perubahan implementasi:
- File dan fungsi utamanya.
- Kontrak/migration/permission yang berubah.

Bukti pengujian:
- Perintah, direktori, exit code, hasil.
- Unit vs PostgreSQL integration vs mock vs live.

Belum diuji / blocked:
- Apa yang tidak tersedia dan dampaknya.

Efek eksternal:
- Ada/tidak; kanal dan otorisasi bila memang diizinkan.

Risiko dan batas fitur:
- Termasuk legacy status dan batas isolasi gateway.

Cara menjalankan demo lokal:
- Langkah yang sudah benar-benar tersedia.

Tugas berikutnya:
- Satu milestone atau perbaikan yang paling relevan.
```

Jangan push/merge otomatis. Siapkan ringkasan perubahan untuk review. Bila pemilik proyek kemudian meminta PR/push, ikuti instruksi tersebut dan aturan repository yang berlaku.

---

## 20. Referensi dan batas kepastian

**Sumber repository yang diperiksa saat menyusun dokumen:**

- [R1] `AGENTS.md`: batas arsitektur, canonical terms, aturan kerja dan migration.
- [R2] `services/api/app/services/reports.py`: jalur perubahan status yang belum menjadi pengiriman eksternal.
- [R3] `.github/workflows/ci.yml`: perintah pemeriksaan backend, dashboard, dan plugin.
- [R4] Snapshot branch yang diperiksa: commit `380b10028a50fcbd8e29f4c23d86fc95cafa3e77`.

**Dokumentasi primer pendukung:**

- [S1] OpenAI: instruksi proyek Codex melalui `AGENTS.md`.
- [S2] Google: function calling Gemini; model mengusulkan fungsi dan aplikasi mengeksekusinya.
- [S3] AWS: transactional outbox dan kebutuhan idempotensi.
- [S4] OpenClaw: batas kepercayaan gateway dan keamanan multiuser.
- [S5] SP4N-LAPOR!: konteks kanal pengaduan, bukan credential atau kontrak API LaporPak.

[R1]: https://github.com/aanjardev/LaporPak/blob/380b10028a50fcbd8e29f4c23d86fc95cafa3e77/AGENTS.md
[R2]: https://github.com/aanjardev/LaporPak/blob/380b10028a50fcbd8e29f4c23d86fc95cafa3e77/services/api/app/services/reports.py
[R3]: https://github.com/aanjardev/LaporPak/blob/380b10028a50fcbd8e29f4c23d86fc95cafa3e77/.github/workflows/ci.yml
[R4]: https://github.com/aanjardev/LaporPak/commit/380b10028a50fcbd8e29f4c23d86fc95cafa3e77
[S1]: https://developers.openai.com/codex/guides/agents-md
[S2]: https://ai.google.dev/gemini-api/docs/function-calling
[S3]: https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html
[S4]: https://docs.openclaw.ai/gateway/security
[S5]: https://sp4n.lapor.go.id/tentang

**Batas dokumen:** nama endpoint, schema, tabel baru, tools, dan milestone adalah usulan implementasi. Dokumen ini tidak mengklaim model telah dilatih, kode telah diubah, tests aplikasi telah dijalankan, akses pemerintah telah tersedia, atau deployment sudah aman. Verifikasi HEAD lokal dan sumber resmi saat setiap milestone dikerjakan.

**Prioritas akhir:** satu alur penerusan yang sah, dapat dijalankan, dan mempunyai bukti lebih penting daripada banyak agent atau rekomendasi yang tidak pernah masuk ke kanal penerima.
