# Dashboard Analitik Admin Desa

Status: kontrak dan endpoint backend sudah berada di `main`. Frontend pada
`feat/frontend-village-dashboard` sudah terintegrasi dengan API serta database
development; merge frontend dan verifikasi deployment masih menunggu.

## Tujuan dan pembagian kerja

Beranda `/reports/dashboard` membantu Admin Desa melihat beban layanan dan
pekerjaan yang menunggu tindakan. Super Admin tetap menggunakan `/admin`.
Ferdi mengerjakan frontend; Anjar mengerjakan endpoint agregasi dan izin;
Farel mengonfirmasi kriteria sumber ASK yang layak dipakai. Tidak ada perubahan
keputusan administratif, instrumentasi percakapan ASK, atau migration baru.

## Kontrak endpoint

`GET /api/v1/villages/{village_id}/dashboard?days=30`, dengan bearer token admin.
`days` berupa 7, 30, atau 90 (default 30). FastAPI memverifikasi akun aktif,
role `village_admin`, membership, serta desa `approved` dan aktif.
Super Admin menerima 403; desa tidak ada atau di luar membership menerima 404.
Desa yang ada dalam membership tetapi belum `approved` atau tidak aktif menerima
`403 VILLAGE_INACTIVE`.
Token tidak valid menerima 401, query invalid 422, layanan gagal 503 dengan
error envelope standar. Respons sukses memakai `Cache-Control: private, no-store`.

Respons JSON (seluruh field wajib, bilangan count nonnegatif):

```ts
type Dashboard = {
  village: { id: string; name: string };
  period: { days: 7 | 30 | 90; start_date: string; end_date: string; timezone: "Asia/Jakarta" };
  generated_at: string;
  kpis: { reports_created: number; requests_created: number; needs_attention: number; ask_ready: number };
  attention_counts: { reports: number; requests: number; knowledge: number };
  report_status_counts: {
    pending_verification: number; verified: number; in_progress: number;
    forwarded: number; resolved: number; rejected: number;
  };
  request_status_counts: { pending_review: number; approved: number; rejected: number; completed: number };
  knowledge: { active: number; ready: number; draft: number; failed: number; processing: number };
  daily: { date: string; reports: number; requests: number }[];
  attention: {
    kind: "report" | "request" | "knowledge";
    id: string; label: string; status: string; created_at: string;
  }[];
};
```

Tanggal memakai YYYY-MM-DD; timestamp ISO 8601 bertimezone. Periode mencakup
hari ini dan `days - 1` hari sebelumnya menurut Asia/Jakarta. Batas awal adalah
00:00 WIB; hari ini dihitung hanya sampai `generated_at`. `daily` berurutan naik,
tepat sebanyak `days`, termasuk tanggal tanpa data (nol). KPI masuk adalah
jumlah baris dibuat dalam periode, sama dengan jumlah seri harian masing-masing.

Distribusi status, antrean, dan kesiapan ASK adalah **snapshot saat ini untuk
seluruh umur data desa**, tidak dibatasi periode grafik. Label UI wajib
membedakannya dari angka masuk selama periode.

- REPORT perlu tindakan: `pending_verification`.
- REQUEST perlu tindakan: `pending_review`.
- ASK perlu tindakan: sumber aktif yang `draft` ATAU `failed`. Satu sumber
  dihitung sekali; kegagalan pemrosesan menjadi status antrean ketika keduanya benar.
- ASK siap: aktif, review `approved`, pemrosesan `ready`. Bukan jumlah pertanyaan warga.
- `knowledge.active`: seluruh sumber aktif; `draft` dan `failed` dapat beririsan;
  `processing` mencakup `pending` dan `processing`. Jangan menjumlahkan kategori
  ASK tersebut untuk mendapatkan total.
- Antrean maksimal delapan entitas, urut `created_at` menurun, lalu kind/id untuk
  urutan deterministik. Total KPI berasal dari seluruh antrean, bukan delapan item.
- Label REPORT/REQUEST hanya nomor tiket; label ASK adalah `Sumber ASK`.
  Status antrean hanya `pending_verification`, `pending_review`, `draft`, `failed`
  sesuai kind. Tidak ada identitas warga, judul bebas, alamat, isi, atau path storage.
- Semua status canonical disertakan, termasuk nol. Agregasi dilakukan dalam SQL
  dengan scope desa; tidak mengunduh seluruh daftar ke browser untuk dihitung.

## Tampilan

Gunakan token, Plus Jakarta Sans, sidebar, panel putih, border, radius, dan
kontrol 44 px dari `design-system.md`. Empat KPI: laporan masuk, pengajuan
masuk, butuh tindakan, sumber ASK siap. Grafik batang berkelompok navy/kuning
menampilkan REPORT dan REQUEST masuk. Grid desktop 8/4 menempatkan antrean
di samping grafik; layar sempit menjadi satu kolom. Sediakan tabel angka
alternatif untuk grafik. Ringkasan status tiga modul berada di bawahnya.

Periode tersimpan dalam URL `?days=7|30|90`; nilai URL lain kembali ke 30.
Antrean API menuju detail yang sudah ada; mock tidak menautkan ID sintetis ke
pengajuan atau sumber nyata. Tautan modul lengkap tetap tersedia.
Snapshot diberi waktu pembaruan; tombol Segarkan melakukan pembacaan ulang.
Tidak ada polling, persentase pertumbuhan, target SLA, atau statistik AI rekaan.

## State dan integrasi

Sesi dan profil admin tetap wajib pada mode mock. Gunakan `REPORTS_DATA_SOURCE`;
`api` tidak boleh fallback menjadi mock ketika endpoint gagal. Fixture hanya
development dan ditandai Data simulasi. Akun tanpa desa diarahkan onboarding,
Super Admin ke `/admin`, desa belum aktif diberi petunjuk menuju pengaturan.
401 dari endpoint ke login, `403 VILLAGE_INACTIVE` ke petunjuk aktivasi,
403 lain ke akses ditolak, scoped 404 ke not-found, 422 kembali ke periode 30,
serta 503/jaringan/payload invalid ke error umum dan coba lagi. Nol adalah data valid.

PR dokumentasi dan endpoint Anjar sudah masuk `main`. Frontend berada pada
`feat/frontend-village-dashboard` dan sudah diuji memakai API/database development.
Jangan menyatakan konfirmasi Farel atau bukti deployment sebelum tersedia.

## Acceptance checklist

- [x] Anjar menyetujui kontrak, scope dan definisi snapshot/periode.
- [ ] Farel mengonfirmasi kriteria ASK siap mengikuti retrieval production.
- [x] Endpoint SQL agregat dan uji isolasi dua desa lulus (Anjar).
- [x] Mock/API memiliki bentuk sama; tidak mencampur sumber saat gagal.
- [x] Redirect role, URL periode, antrean, refresh, nol, loading, dan error lulus.
- [x] Grafik/tabel dan keyboard aman pada 390, 768, 1280 px.
- [x] Lint, TypeScript, test auth/report/knowledge/request/dashboard, build lulus.
- [x] Uji API nyata mencocokkan KPI, seri harian, status, dan antrean dengan database.
- [x] 401/403/scoped 404/422/503 dan payload tanpa PII diuji pada backend.

Catat SHA, tanggal, lingkungan, dan batas mock/API setiap kali menambah bukti.


## Bukti frontend — 20 September 2026

Baseline backend `e15b1f8`; kontrak awal `5b580ea`; implementasi pada branch
`feat/frontend-village-dashboard` (working tree, belum merge).

- Lint, TypeScript, 27 tes frontend (dashboard 7, REPORT 10, auth 3,
  knowledge 4, REQUEST 3), dan production build lulus. Sebelas tes backend
  dashboard serta Ruff untuk file terkait juga lulus.
- Browser lokal dengan sesi Supabase yang sudah tersedia dan sumber **mock**:
  periode 90 hari tersimpan di URL, tabel harian dapat dibuka, angka nol,
  loading dan kegagalan layanan tampil sesuai state.
- Lebar 390, 768, dan 1280 px diperiksa tanpa overflow horizontal; drawer
  ponsel dapat ditutup dengan Escape. Bug hydration pada judul SVG ditemukan
  dan diperbaiki dengan satu string judul.
- Grafik mengelompokkan 1/3/7 hari untuk periode 7/30/90 hari agar terbaca
  di ponsel. Tabel alternatif tetap menyajikan setiap tanggal, termasuk nol.
- Mapping tautan antrean diuji otomatis. Antrean **mock** sengaja tidak
  membuka detail karena ID sintetis tidak ada pada API REQUEST/ASK nyata.
  API development menghasilkan antrean kosong yang cocok dengan database;
  klik item API non-kosong masih menunggu data berstatus perlu tindakan.
- Respons 401/403/404/422/503 dan kegagalan jaringan diuji pada lapisan data
  dengan fetch simulasi; ini bukan bukti otorisasi backend.
- Konfigurasi lokal memakai `REPORTS_DATA_SOURCE=api` saat uji integrasi.
  API tidak pernah diganti mock secara otomatis ketika gagal.
- API development dan agregasi database cocok: 6 REPORT, 2 REQUEST, antrean
  0, 10 sumber ASK aktif, 30 titik harian, serta seluruh distribusi status.
  Nilai nol tampil sebagai data. Periode 7/30/90, normalisasi query invalid,
  refresh tanpa polling, redirect role, tabel alternatif, dan loading diuji.

Belum diverifikasi: item antrean API non-kosong, akun desa kedua pada browser,
dan konfirmasi Farel bahwa kriteria ASK siap sesuai retrieval production.
