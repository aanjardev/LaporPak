# Dashboard LaporPak

Dashboard menggunakan Next.js, TypeScript, Tailwind CSS, dan shadcn/ui. Daftar, detail, dan simulasi keputusan petugas memakai data sintetis sesuai [kontrak API](../../docs/api-contract.md).

## Menjalankan lokal

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Buka `http://localhost:3000/reports`. Secara default, `REPORTS_DATA_SOURCE=mock` memakai laporan sintetis. Pencarian, filter status/kategori, dan pagination disimpan pada URL.

Untuk memeriksa state kosong, error, atau loading pada mode development, set `REPORTS_MOCK_SCENARIO` menjadi `empty`, `error`, atau `slow` di `.env.local`, lalu mulai ulang server. Nilai default adalah `normal`. Skenario tersebut diabaikan pada build production.

Pada detail laporan berstatus menunggu verifikasi, pilih **Verifikasi laporan** atau **Tolak laporan**, isi alasan, lalu simpan. Badge dan riwayat akan berubah di layar setelah simulasi berhasil; muat ulang halaman untuk kembali ke fixture awal. Untuk menguji proses lambat atau gagal, set `REPORTS_MOCK_MUTATION_SCENARIO=slow` atau `error` di `.env.local` dan mulai ulang server. Laporan pertama memiliki deskripsi panjang dan ringkasan kosong; laporan kelima memiliki riwayat status panjang. Lokasi mock hanya berupa teks tanpa koordinat.

Lapisan data berada di `lib/reports.ts`. Mode `api` memakai `NEXT_PUBLIC_API_URL` untuk membaca laporan; aksi perubahan status tetap dinonaktifkan sampai autentikasi admin dan endpoint PATCH siap. Jangan membuka dashboard dengan data nyata ke publik sebelum kontrol akses admin diterapkan.

## Pemeriksaan

```powershell
npm run lint
npx tsc --noEmit
npm run test:reports
npm run build
```

Build saat ini memerlukan akses untuk mengambil font Geist melalui `next/font/google`. Jika jaringan memblokir Google Fonts, build dapat gagal meskipun pemeriksaan TypeScript berhasil.
