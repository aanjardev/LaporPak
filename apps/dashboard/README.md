# Dashboard LaporPak

Dashboard menggunakan Next.js, TypeScript, Tailwind CSS, dan shadcn/ui. Saat ini halaman utama masih template Next.js; tampilan dan alur kerja admin belum dibuat.

## Menjalankan lokal

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Buka `http://localhost:3000`. `NEXT_PUBLIC_API_URL` di `.env.local` menunjuk ke API lokal pada `http://localhost:8000`; frontend belum memakai variabel ini untuk mengambil data.

## Pemeriksaan

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

Build saat ini memerlukan akses untuk mengambil font Geist melalui `next/font/google`. Jika jaringan memblokir Google Fonts, build dapat gagal meskipun pemeriksaan TypeScript berhasil.
