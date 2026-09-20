# Dashboard Analitik Admin Desa

Status: kontrak usulan untuk ditinjau Anjar; implementasi frontend dan fixture
tidak menjadi bukti endpoint atau otorisasi backend sudah tersedia.

## Tujuan dan pembagian kerja

Beranda `/reports/dashboard` membantu Admin Desa melihat beban layanan dan
pekerjaan yang menunggu tindakan. Super Admin tetap menggunakan `/admin`.
Ferdi mengerjakan frontend; Anjar mengerjakan endpoint agregasi dan izin;
Farel mengonfirmasi kriteria sumber ASK yang layak dipakai. Tidak ada perubahan
keputusan administratif, instrumentasi percakapan ASK, atau migration baru.

## Kontrak usulan

`GET /api/v1/villages/{village_id}/dashboard?days=30`, dengan bearer token admin.
`days` berupa 7, 30, atau 90 (default 30). FastAPI memverifikasi akun aktif,
role `village_admin`, membership, serta desa `approved` dan aktif.
Super Admin menerima 403; desa tidak ada atau di luar membership menerima 404.
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
401 dari endpoint ke login, 403 ke akses ditolak, scoped 404 ke not-found,
503/jaringan/payload invalid ke error umum dan coba lagi. Nol adalah data valid.

Alur delivery: review dan merge PR dokumentasi; Anjar mengimplementasikan endpoint
pada `feat/api-village-dashboard`; Ferdi membangun UI pada
`feat/frontend-village-dashboard`; integrasikan dan uji API development setelah
endpoint siap. Jangan menyatakan persetujuan Anjar/Farel atau bukti live sebelum ada.

## Acceptance checklist

- [ ] Anjar menyetujui kontrak, scope dan definisi snapshot/periode.
- [ ] Farel mengonfirmasi kriteria ASK siap mengikuti retrieval production.
- [ ] Endpoint SQL agregat dan uji isolasi dua desa lulus (Anjar).
- [ ] Mock/API memiliki bentuk sama; tidak mencampur sumber saat gagal.
- [ ] Redirect role, URL periode, antrean, refresh, nol, loading, dan error lulus.
- [ ] Grafik/tabel dan keyboard aman pada 390, 768, 1280 px.
- [ ] Lint, TypeScript, test auth/report/knowledge/request/dashboard, build lulus.
- [ ] Uji API nyata mencocokkan KPI, seri harian, status, dan antrean dengan database.
- [ ] 401/403/scoped 404/422/503 dan payload tanpa PII diuji pada backend.

Catat SHA, tanggal, lingkungan, dan batas mock/API setiap kali menambah bukti.
