# Rencana ASK, TRACK, dan AI Lokal LaporPak

Status: baseline ASK/TRACK/REPORT telah diimplementasikan. Backend juga memiliki
baseline teknis REQUEST `residency_letter`, sedangkan flow dan tool OpenClaw
REQUEST belum tersedia dan frontend masih memakai pratinjau sintetis.
Dasar: document.md yang diberikan pengguna, PRD V3, inspeksi kode lokal pada
17 September 2026, dan rujukan di akhir dokumen. Kontrak runtime terkini tetap
berada di `docs/api-contract.md`; dokumen ini menyimpan keputusan desain dan tahap
lanjutan yang belum masuk baseline.

## 1. Keputusan dan penilaian kelayakan

Ide tersebut realistis jika dibangun bertahap. Nilai utama adalah membantu warga
memahami langkah yang relevan, mencatat masalah, lalu melihat tindak lanjutnya.
Keunikan tidak cukup berupa persona ramah: kualitas sumber lokal, kesinambungan
percakapan, dan keterlacakan tindakan lebih menentukan.

Asumsi awal karena desa, SOP, dan jadwal pilot belum diberikan:

- Satu desa simulasi, satu akun WhatsApp, teks Bahasa Indonesia sebagai baseline.
- Tiga kelompok ASK administrasi: jam/kontak layanan, persiapan pengantar dokumen
  kependudukan, dan alur perbaikan data. Tiga kelompok lingkungan: jalan, sampah,
  drainase. Persyaratan dan kewenangan nyata harus mengikuti SOP yang disetujui.
- TRACK hanya laporan LaporPak milik pengirim yang terautentikasi. Bukan pelacakan
  aplikasi Dukcapil, bansos, atau instansi lain tanpa integrasi resmi.
- REQUEST memiliki API create/admin sebagai baseline teknis, tetapi belum boleh
  diaktifkan sebagai layanan warga sebelum SOP, data minimum, pejabat pemberi
  keputusan, dan tool OpenClaw disahkan serta diuji.
- Data simulasi diberi label pada setiap jawaban dan tidak diaktifkan di produksi.
- Tidak ada fine-tuning model, voice, prediksi ETA, pengiriman notifikasi otomatis,
  atau multi-desa produksi pada rilis pertama.

Kondisi kode saat inspeksi 17 September 2026 (historis):

- Backend memiliki health dan POST pembuatan laporan. GET admin, PATCH status,
  ASK, dan TRACK belum ditemukan pada route yang terdaftar.
- Schema AI aktif hanya REPORT/UNKNOWN. Tabel knowledge dan conversation sudah
  tersedia dalam migration, tetapi belum membuktikan retrieval atau state flow.
- Perubahan foto masih berada di working tree. Instruksi pengguna terbaru
  mewajibkan minimal satu foto, sedangkan kode/dokumen lokal masih memiliki
  attachment_waived. Ini harus diselaraskan sebelum rilis berikutnya.
- Pemeriksaan ini tidak membuktikan bahwa WhatsApp sudah terhubung atau seluruh
  perubahan lokal sudah lulus tes. Verifikasi runtime tetap diperlukan.

Temuan historis di atas sudah ditindaklanjuti: route admin REPORT, ASK, TRACK,
validasi foto wajib, dan penghapusan `attachment_waived` tersedia pada baseline
saat ini. Bagian tersebut dipertahankan hanya sebagai jejak alasan penyusunan
rencana; gunakan status pada pembuka dokumen dan
[rencana delivery MVP](mvp-delivery-plan.md) untuk progress terbaru.

## 2. Brainstorming yang diprioritaskan

| Ide | Nilai untuk warga/operator | Keputusan |
|---|---|---|
| ASK dengan sumber, versi, tanggal berlaku | Warga tahu dasar informasi | Rilis pertama |
| Panduan berdasarkan masalah dan hambatan | Mengurangi bolak-balik karena berkas kurang | Rilis pertama |
| TRACK: status, waktu perubahan, langkah berikut | Warga tidak perlu berulang kali menghubungi petugas | Rilis pertama |
| Tanya satu hal yang belum jelas | Percakapan lebih mudah diikuti | Rilis pertama |
| Kamus istilah dan patokan setempat | Memahami "got", "selokan", nama dusun/pasar | Rilis pertama, dengan konfirmasi ambiguitas |
| Jejak sumber dan fakta per percakapan | Operator dapat menelusuri alasan jawaban | Rilis pertama, tanpa menyimpan chain-of-thought |
| Daftar pertanyaan yang belum terjawab | Menunjukkan SOP mana yang perlu dilengkapi | Rilis pertama, ekspor untuk review manusia |
| Voice note | Aksesibilitas bagi pengguna yang kesulitan mengetik | Tahap lanjut setelah evaluasi teks |
| Foto memulai draf | Mengurangi beban mengetik | Tahap lanjut; lokasi tetap perlu bukti/konfirmasi |
| Ringkasan dan saran jawaban operator | Mengurangi pekerjaan berulang | Sesudah TRACK dan akses admin stabil |
| Notifikasi status otomatis | Menutup tindak lanjut tanpa warga harus bertanya | Sesudah pull TRACK, persetujuan penerima dan retry siap |
| Prediksi ETA dan pola wilayah | Membantu perencanaan | Tunda hingga data historis memadai dan dievaluasi |
| Upvote komunitas, akses kependudukan | Manfaat belum sebanding scope dan risiko | Di luar rilis pertama |

Koreksi penting terhadap ide sumber:

1. Emosi memengaruhi empati bahasa. Prioritas ditentukan fakta dampak dan risiko,
   dengan keputusan operasional tetap pada petugas; keluhan marah tidak otomatis urgent.
2. Lokasi tidak boleh disimpulkan dari tampilan foto. EXIF, jika tersedia, hanya
   petunjuk tidak tepercaya. "Dekat masjid" yang ambigu memerlukan klarifikasi.
3. Confidence model bukan probabilitas benar yang sudah terkalibrasi. Operator
   lebih membutuhkan asal fakta: teks warga, share location, SOP, atau konfirmasi.
4. Rahasia tidak sama dengan anonim. Sistem yang mengidentifikasi akun WhatsApp
   tidak boleh menjanjikan anonimitas terhadap pengelola. Mode rahasia perlu
   pembatasan akses yang nyata sebelum dipasarkan.
5. Jangan menyebut laporan "sudah masuk antrean" saat penyimpanan gagal. Pengakuan
   diterima memerlukan penyimpanan durable dan identitas event yang bisa ditelusuri.
6. Jika foto tidak dapat diberikan, simpan draf dan arahkan ke kontak terverifikasi;
   jangan terbitkan tiket atau memakai waiver yang bertentangan instruksi terbaru.

## 3. Pengalaman warga dan pustaka skenario

Setiap skenario adalah kartu data terversi, bukan prompt panjang atau workflow
engine baru. Field: scenario_id, version, problem, example_utterances, service_key,
required_context, clarification_questions, source_ids, allowed_next_actions,
handoff_conditions, dan acceptance_cases. Kartu tidak boleh mengarang fakta SOP.

| Pesan/kondisi | Alur yang diharapkan | Batasan |
|---|---|---|
| "Besok kantor buka?" | ASK membaca jadwal dan tanggal lokal | Tanpa kalender libur khusus, jelaskan jadwal reguler belum menjamin besok buka |
| "Mau urus KTP, mulai dari mana?" | ASK membedakan kebutuhan baru/perubahan/kehilangan jika SOP membedakannya | Jangan menganggap desa penerbit semua dokumen |
| "Berkas saya kurang satu" | ASK memeriksa layanan dan daftar syarat yang sudah disetujui | Tidak mengubahnya menjadi pengajuan REQUEST |
| "Nama di dokumen beda" | ASK panduan perbaikan sesuai instansi berwenang | Tidak meminta NIK atau scan dokumen untuk pertanyaan umum |
| "Selokan mampet, lapornya ke siapa?" | ASK rujukan lokal lalu tawarkan REPORT | Pertanyaan saja tidak otomatis menjadi laporan |
| "Tolong laporkan sampah di RT 02" | REPORT: fakta, lokasi, foto, ringkasan, konfirmasi | Konfirmasi untuk draf terbaru, bukan "ya" lama |
| "Laporan saya kemarin bagaimana?" | TRACK mencari laporan pengirim dan rentang tanggal lokal | Jika beberapa cocok, tampilkan pilihan singkat |
| "LP-2026-xxxx sudah selesai?" | TRACK membaca status terbaru dari DB | Ticket number bukan bukti kepemilikan |
| "Katanya sudah dikerjakan?" | TRACK mengutamakan catatan resmi | Tidak menaikkan status berdasarkan ucapan warga |
| "Tadi jalan yang mana?" | Pulihkan draf/hasil terakhir milik sesi itu | Klarifikasi jika lebih dari satu referensi |
| Sedang REPORT, bertanya jam kantor | Jawab ASK, lalu tawarkan melanjutkan draf | Tidak kehilangan foto, lokasi, atau UUID draf |
| "Ya, tapi lokasinya RT 04" | Koreksi draf dan minta konfirmasi ulang | Tidak membuat laporan dari draf RT 03 |
| SOP tidak ada/kedaluwarsa/bertentangan | ASK menyatakan belum bisa memastikan, beri kontak yang valid jika ada | Tidak menutup kekurangan sumber dengan pengetahuan model |
| Meminta status laporan tetangga | Respons tidak ditemukan/tidak dapat diakses | Tidak mengungkap bahwa tiket itu ada |
| Panik dengan bahaya langsung | Nada singkat; arahkan ke kanal darurat yang telah diverifikasi | Chat bukan dispatch darurat; jangan meminta bukti berbahaya |
| "Saya mau cek bansos saya" | ASK prosedur pengecekan resmi | Jangan mengaku TRACK dapat membaca database bansos |

Contoh TRACK memakai fixture simulasi:

> SIMULASI — Tiket LP-2026-0042 masih menunggu verifikasi. Perubahan terakhir:
> 17 September, 09.15 WIB. Langkah berikutnya adalah pemeriksaan oleh petugas.
> Belum ada jadwal penyelesaian yang tercatat.

Jawaban selalu membedakan status yang sudah terjadi, langkah prosedural berikutnya,
dan jadwal resmi jika memang tercatat. Riwayat percakapan tidak menggantikan lookup DB.

## 4. Desain implementasi

### 4.1 Arsitektur dan kontrak

Tetap WhatsApp → OpenClaw/Gemini → tool terotorisasi → FastAPI → Supabase.
OpenClaw menjadi satu-satunya pemanggil model. Tidak menambahkan model caller di
FastAPI, SQL tool, Redis, workflow engine, atau service AI terpisah.

Kontrak ASK/TRACK dan kewajiban foto sudah masuk baseline. Schema REPORT tetap
terpisah dari routing ASK/REPORT/TRACK/REQUEST/UNKNOWN agar ASK tidak wajib
mengisi field laporan. Backend mempunyai aksi submit REQUEST, tetapi OpenClaw
belum memiliki tool submit dan layanan belum boleh aktif sebelum SOP disahkan.

Interface aktif:

| Interface | Input dan hasil | Otorisasi |
|---|---|---|
| POST /api/v1/ask | question, optional service_key/query_embedding → outcome, answer_blocks, sources | Internal OpenClaw |
| POST /api/v1/track | trusted sender, optional ticket_number → checked_at, items + timeline | Internal OpenClaw + kepemilikan REPORT/REQUEST |
| laporpak_ask | question, optional service_key | Tool tanpa argumen identitas/desa dari model |
| laporpak_track_report | optional ticket_number `LP-*` | Plugin menyuntik identitas dari runtime WhatsApp; dukungan `REQ-*` belum aktif |

Pertahankan X-OpenClaw-API-Key dan error envelope yang ada. Sender/session/account
diisi adapter dari metadata kanal, bukan dipilih model. POST TRACK menghindari
nomor pengirim dalam URL; request body sensitif tidak boleh dicatat ke log umum.
Endpoint admin GET/PATCH tetap khusus admin; tidak dibuka untuk keperluan TRACK.

### 4.2 ASK: sumber lebih dahulu, jawaban sesudahnya

- Gunakan knowledge_documents dan knowledge_chunks. Ingest kartu layanan JSON
  tervalidasi dari data/knowledge-base; jangan membuat tabel knowledge paralel.
- Dokumen memiliki source_key, judul, instansi penerbit, source_url opsional,
  version, scope desa, approval_status, approved_by, approved_at, effective_from,
  effective_until, review_due_at, serta label simulation. Field kontrol status,
  scope, dan tanggal menjadi kolom; alias/section/service_key boleh metadata.
- Approver adalah petugas/editor yang ditunjuk. V1 memakai file review + import CLI
  idempotent terotorisasi, belum perlu CMS. Impor versi baru secara transaksional;
  simpan versi lama untuk jejak audit, nonaktifkan dari retrieval aktif.
- Scope pilot berasal dari konfigurasi server, bukan nomor telepon, bahasa, IP,
  atau tebakan Gemini. Sumber nasional hanya dipakai bila relevansinya sudah
  ditinjau; tidak ada aturan "dokumen lokal selalu mengalahkan aturan nasional".
- Mulai retrieval PostgreSQL full-text search konfigurasi simple + daftar alias
  terkurasi. Pecah sumber per bagian layanan, bukan chunk token buta; batasi top-5.
  Semua query memakai parameter terikat. Filter approved, scope, tanggal, dan
  simulation sebelum mengambil kandidat.
- Alias layanan dapat memilih kartu secara eksplisit. Jika beberapa layanan
  cocok, berikan pilihan; skor pencarian tinggi saja bukan izin menjawab.
- Jawaban faktual v1 berasal dari answer blocks yang telah disetujui, dipilih
  oleh service/section yang tervalidasi. Gemini memahami bahasa dan membimbing
  percakapan; biaya, syarat, kontak, jam, dan SLA disalin dari blok, tidak dibuat
  ulang secara bebas. Adapter menyertakan sitasi dari hasil backend.
- Sumber dikembalikan sebagai document_id, chunk_id, title, version, source_url,
  dan tanggal review. Jika tidak ada URL publik, tampilkan judul/versi, bukan link
  internal atau URL buatan. Simpan snapshot sumber untuk audit jawaban.
- outcome adalah answered, clarify, atau unavailable. Kedaluwarsa, konflik sumber,
  atau informasi yang tidak termuat menghasilkan unavailable/clarify, bukan tebakan.
- Simpan pertanyaan yang gagal sebagai knowledge gap dengan data pribadi dihapus,
  lalu ekspor bagi editor. Pertanyaan warga tidak otomatis menjadi pengetahuan resmi.

Peningkatan hybrid search hanya dilakukan bila recall@5 target gagal setelah
perbaikan alias/chunk. Tahap tersebut menambah pgvector dan embeddings melalui
OpenClaw, digabungkan dengan FTS; bukan prasyarat ASK v1.

### 4.3 TRACK dan jalur admin

- Lookup selalu mengikat laporan ke citizen_id yang di-resolve backend dari
  identitas WhatsApp terautentikasi. Jangan menerima citizen_id dari argumen model.
- Default tampilkan paling banyak lima laporan terbaru milik pengirim. Filter
  ticket_number tepat atau pencarian ringkas milik pengirim saja. Jika lebih dari
  satu kandidat cocok, warga memilih; jangan menebak arti "yang kemarin".
- Respons minimal: ticket_number, ringkasan singkat, status, status_changed_at,
  timeline status dan waktu, checked_at, next_step. Jangan mengembalikan nomor
  telepon, lampiran privat, actor_identifier, atau notes internal admin.
- next_step berasal dari mapping prosedural status yang disetujui, bukan janji
  waktu. Bedakan updated_at umum dari timestamp perubahan status dalam history.
- Nomor tiket orang lain dan tiket tidak ada menghasilkan 404 REPORT_NOT_FOUND
  yang sama. DB error menghasilkan 503; jangan memakai status percakapan lama.
- Implementasikan GET list/detail dan PATCH status admin yang sudah tercantum
  dalam contract bila belum tersedia saat tahap ini dimulai. Supabase Auth invite,
  verifikasi token, lookup admin aktif pada setiap request, transaksi status/history,
  dan larangan transisi di luar map wajib diuji.
- Tabel admin minimal mengikat auth user ID, role, active, dan scope pilot. Jangan
  percaya user_metadata untuk role. Hanya operator yang mengubah status.
- Untuk pilot satu desa, seluruh deployment dan dataset harus milik desa pilot.
  Belum mengaktifkan desa kedua atau menafsirkan responsible_unit_id sebagai
  pemilik tenant. Isolasi multi-desa penuh memerlukan migration terpisah sebelum
  data lebih dari satu desa diterima.

### 4.4 Konteks percakapan dan keterlacakan

- Isolasi session dengan account + channel + sender; gunakan penyimpanan sesi
  durable OpenClaw yang sudah ada untuk draf. Buktikan pemulihan setelah restart.
- Satu draf REPORT aktif per sesi. Simpan draft UUID, revision, confirmed revision,
  fakta dan asalnya, media tervalidasi, serta last selected ticket. Jangan membuat
  framework state machine generik untuk enam skenario.
- State lokal: collecting, awaiting_confirmation, submitted, cancelled. Peralihan
  ASK/TRACK tidak menghapus draf. Koreksi membatalkan konfirmasi revision lama.
- Adapter harus mengikat konfirmasi pesan asli ke draf terbaru; boolean confirmed
  dari Gemini tidak cukup. Jika hook runtime tidak memberikan sender/message ID
  yang bisa dipercaya, submission diblokir sampai integrasi kanal diperbaiki.
- Pertahankan idempotency key hingga laporan berhasil. Konfirmasi ulang sesudah
  submit mengembalikan tiket yang sama, tidak memulai draf baru.
- Gunakan conversation_sessions/messages untuk jejak referensi sesi, event_id,
  intent, scenario_id/version, source IDs/version, tool result, report_id, prompt
  version, model ID, dan timestamp. Tidak menyimpan private chain-of-thought.
- Audit di backend ditulis oleh operasi ASK/TRACK yang bersangkutan; jangan
  mengandalkan model untuk mengaku apakah tool benar-benar dipanggil.
- Jika handoff belum memiliki antrean operasional, tampilkan kontak resmi saja.
  Jangan mengklaim petugas sudah diberi tahu. Draf lama tidak berarti tiket resmi.

### 4.5 Perbaikan REPORT yang menjadi prasyarat

- Ikuti instruksi terbaru: minimal satu foto. Hapus bypass attachment_waived dari
  jalur runtime/contract/tests; jangan hanya memperbaiki prompt.
- Media berasal dari metadata kanal. Jangan membiarkan model memilih URL bebas
  yang kemudian diunduh backend. Pakai referensi media yang divalidasi adapter,
  origin tepercaya, limit byte saat streaming, verifikasi tipe file, dan bucket privat.
- Tangani cleanup objek Storage bila transaksi laporan gagal; transaksi PostgreSQL
  tidak me-rollback upload Storage. Jangan mencetak signed URL/token media ke log.
- Jalankan satu alur WhatsApp nyata: foto + teks → konfirmasi → tiket → admin
  mengubah status → TRACK pengirim. Gunakan data uji, bukan identitas warga nyata.

## 5. Tuning dan ukuran keberhasilan

Tuning pertama menyasar data, retrieval, dan perilaku; bukan training bobot model.

1. Buat 20–30 kartu pengetahuan singkat untuk enam kelompok skenario. Semua fixture
   demo berlabel; sebelum pilot nyata, editor memverifikasi sumber, kewenangan,
   kontak, biaya, jam, dan tanggal berlaku.
2. Susun kamus lokal: singkatan warga, sinonim masalah, nama dusun/RT, serta alias
   patokan. Alias ambigu menjadi kandidat klarifikasi, bukan koordinat otomatis.
3. Respons Bahasa Indonesia netral terlebih dahulu. Bahasa daerah hanya mengikuti
   preferensi warga dan kosakata yang ditinjau penutur lokal. Jangan menyimpulkan
   gender, etnis, atau domisili dari nama/bahasa.
4. Pakai contoh multi-turn: perbaikan, pindah topik, "itu tadi", pertanyaan tanpa
   sumber, dan serangan untuk membaca tiket orang lain. Contoh memberi format
   perilaku, bukan menggantikan sumber faktual.
5. Pertahankan model terpasang sebagai baseline sampai evaluasi perbandingan
   membuktikan perubahan. Verifikasi kompatibilitas schema/tool runtime aktual;
   jangan sekadar mengganti model ID mengikuti contoh dokumentasi terbaru.
6. Ubah satu variabel per eksperimen: prompt, chunk, alias, kemudian model.
   Catat versi, latensi, biaya pemakaian, dan hasil; jangan mengubah semuanya sekaligus.

Dataset awal: 120 percakapan sintetis/reviewed (40 ASK, 30 TRACK, 30 REPORT dan
perpindahan konteks, 20 error/serangan). Pisahkan 80 development dan 40 holdout
berdasarkan keluarga skenario, bukan membagi paraphrase yang sama ke kedua set.
Pertahankan regression suite REPORT yang sudah ada. Tambahkan pengujian deterministik
backend dan integrasi di luar evaluasi model. Ulangi kasus model kritis tiga kali.

Target penerimaan berikut adalah target usulan, bukan hasil yang sudah dicapai:

| Ukuran | Target awal |
|---|---|
| Akses tiket warga lain / aksi status oleh AI | 0 kejadian dalam seluruh suite |
| Status TRACK vs fixture DB | 100% cocok termasuk waktu dan ownership |
| Klaim tiket tanpa persistence / tanpa foto | 0 kejadian |
| ASK biaya, syarat, waktu, kontak tanpa sumber valid | 0 pada kasus rilis |
| Retrieval recall@5 pada pertanyaan yang punya sumber | ≥90% |
| Routing macro-F1 | ≥0,90, juga laporkan per intent |
| Keberhasilan enam keluarga skenario | ≥90% pada holdout |
| Kebocoran konteks antar-pengirim / demo ke produksi | 0 pada tes isolasi |
| Latensi teks | Ukur p50/p95; sasaran p95 ≤10 detik di lingkungan pilot |

Satu set kecil tidak membuktikan aman secara universal. Review manusia memeriksa
dukungan sumber per klaim, kewajaran pertanyaan, dan istilah lokal; LLM judge hanya
membantu menemukan kandidat masalah. CSAT, completion rate, jumlah klarifikasi,
dan waktu operator diukur saat pilot, belum dapat diklaim membaik dari unit test.

## 6. Urutan delivery dan status

1. **Fondasi — tersedia, gerbang integrasi belum seluruhnya tutup:** kewajiban foto dan media,
   buktikan konfirmasi/idempotensi, serta dokumentasikan hasil smoke test. Jangan
   menganggap seluruh P0 selesai berdasarkan README atau test lama.
2. **TRACK + admin — baseline tersedia:** otorisasi admin/status history, endpoint/tool
   TRACK privat, dan rendering status deterministik. Demo: petugas mengubah status,
   pemilik melihat perubahan, pengirim lain tidak dapat melihatnya.
3. **ASK — baseline tersedia:** kontrak, metadata sumber, FTS/alias, answer blocks,
   tool ASK, fixture demo dan refusal saat sumber tidak layak. Demo tidak memerlukan
   menunggu SOP nyata; aktivasi untuk warga nyata memerlukan approval sumber.
4. **Skenario + evaluasi — tersedia, hasil E2E perlu dicatat:** enam keluarga skenario, perpindahan ASK/REPORT/TRACK,
   audit sumber, knowledge gaps, holdout, dan tutorial operator. Update contract,
   architecture, workflows, serta workspace policy dalam PR yang sesuai.
5. **Tahap berikut:** validasi sumber ASK dan kepemilikan TRACK pada kanal nyata,
   finalisasi SOP REQUEST, buat tool submit REQUEST, integrasikan UI petugas,
   lalu uji isolasi dua desa.

Gunakan migration baru dengan nomor berikutnya setelah memeriksa repository saat
implementasi; jangan mengedit migration yang sudah dipakai. RLS dan privilege tabel
baru harus mengikuti akses backend/admin yang diperlukan, tanpa akses anon umum.
Rollback perilaku melalui flags ASK/TRACK yang awalnya off; jangan menghapus laporan.

Validasi setiap PR: backend uv sync, uv run pytest, uv run ruff check .; test plugin
Node; frontend npm run lint dan npm run build bila tersentuh. Jangan commit secret
atau perubahan lokal milik pekerjaan lain secara tidak sengaja. Implementasi baseline
sekarang mencakup ASK bersumber, TRACK privat, jalur admin, media WhatsApp tepercaya,
idempotensi REPORT, dan evaluasi hybrid. REQUEST penuh, aktivasi multi-desa produksi,
dan evaluasi model end-to-end tetap mengikuti gerbang yang dijelaskan di atas.

Perkiraan usaha untuk perencanaan: sekitar 2–4 minggu kerja satu engineer yang
menguasai stack, termasuk stabilisasi fondasi dan pengujian, setelah akses dan bahan
tersedia. Ini estimasi bersyarat, bukan janji; SOP belum siap dan integrasi media
yang belum terbukti dapat memperpanjang pilot.

Gunakan asumsi desa simulasi sampai SOP nyata disetujui. Jangan memberi AI akses
database atau mutation status, dan jangan mengaktifkan fitur warga nyata sebelum
gerbang sumber, kepemilikan, otorisasi, dan fallback lulus.

## 7. Rujukan dan penggunaannya

- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output):
  dasar schema output terstruktur; validasi schema tetap berbeda dari kebenaran fakta.
- [Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling):
  dasar pemanggilan tool; izin dan eksekusi tetap dikontrol aplikasi.
- [Supabase full-text search](https://supabase.com/docs/guides/database/full-text-search)
  dan [hybrid search](https://supabase.com/docs/guides/ai/hybrid-search): baseline
  retrieval native dan opsi menggabungkan pencarian kata dengan makna. Pemilihan
  FTS dahulu adalah keputusan scope proyek ini, bukan klaim FTS selalu lebih baik.
- [Google Cloud: evaluasi RAG](https://cloud.google.com/blog/products/ai-machine-learning/optimizing-rag-retrieval):
  dasar memisahkan kualitas retrieval dari groundedness jawaban.
- [GOV.UK question pages](https://design-system.service.gov.uk/patterns/question-pages/):
  prinsip fokus satu pertanyaan; penerapannya pada chat di sini adalah adaptasi desain.
- [SP4N-LAPOR!](https://www.lapor.go.id/tentang): inspirasi no wrong door, tracking ID,
  serta pembedaan anonim/rahasia. Bukan klaim LaporPak terintegrasi dengan SP4N.
- [NusaX, EACL 2023](https://aclanthology.org/2023.eacl-main.57/): referensi keragaman
  bahasa lokal dan evaluasi. Dataset sentimen/terjemahan ini bukan SOP desa atau
  benchmark pengaduan yang siap dipakai tanpa penyesuaian domain dan lisensi.
- [Gemini audio](https://ai.google.dev/gemini-api/docs/audio): kelayakan input suara
  untuk tahap lanjut; akurasi dialek/nama tempat tetap perlu diuji dengan warga lokal.
- [OpenClaw WhatsApp](https://docs.openclaw.ai/channels/whatsapp): referensi kanal
  pilot, pairing, dan sesi. Keberhasilan API saja tidak membuktikan alur WhatsApp.
