# Dashboard LaporPak

Dashboard menggunakan Next.js, TypeScript, Tailwind CSS, dan shadcn/ui. Tahap pertama menyediakan daftar dan detail REPORT dengan data sintetis sesuai [kontrak API](../../docs/api-contract.md).

## Menjalankan lokal

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Buka `http://localhost:3000/reports`. Secara default, `REPORTS_DATA_SOURCE=mock` memakai laporan sintetis. Pencarian, filter status/kategori, dan pagination disimpan pada URL.

Untuk memeriksa state kosong, error, atau loading pada mode development, set `REPORTS_MOCK_SCENARIO` menjadi `empty`, `error`, atau `slow` di `.env.local`, lalu mulai ulang server. Nilai default adalah `normal`. Skenario tersebut diabaikan pada build production.

Lapisan data berada di `lib/reports.ts`. Setelah endpoint FastAPI dan autentikasi admin siap, set `REPORTS_DATA_SOURCE=api` untuk memakai `NEXT_PUBLIC_API_URL`. Jangan membuka dashboard dengan data nyata ke publik sebelum kontrol akses admin diterapkan.

## Pemeriksaan

```powershell
npm run lint
npx tsc --noEmit
npm run test:reports
npm run build
```

Build saat ini memerlukan akses untuk mengambil font Geist melalui `next/font/google`. Jika jaringan memblokir Google Fonts, build dapat gagal meskipun pemeriksaan TypeScript berhasil.
