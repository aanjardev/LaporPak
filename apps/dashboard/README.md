# Dashboard LaporPak

Dashboard menggunakan Next.js, TypeScript, Tailwind CSS, dan shadcn/ui. Login petugas memakai Supabase Auth. Daftar, detail, dan simulasi keputusan petugas memakai data sintetis sesuai [kontrak API](../../docs/api-contract.md).

## Menjalankan lokal

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` di `.env.local` memakai URL proyek dan **anon key publik** dari Supabase. Jangan menyalin `SUPABASE_SERVICE_ROLE_KEY` atau secret backend. File `.env.local` diabaikan Git.

Untuk menguji login sekarang, buat satu akun uji dengan email, kata sandi, dan email terkonfirmasi melalui **Supabase Dashboard → Authentication → Users**. Nonaktifkan pendaftaran pengguna publik pada pengaturan Auth. Tahap ini memakai akun yang dibuat admin secara manual; alur undangan dan redirect email akan disiapkan kemudian. Masukkan kata sandi langsung di halaman login, bukan di repository atau chat.

Buka `http://localhost:3000/login`. Tanpa sesi, `/reports` dan detailnya mengarah ke login. Setelah login, sesi bertahan saat halaman dimuat ulang; tombol **Keluar** mengakhiri sesi. Secara default, `REPORTS_DATA_SOURCE=mock` memakai laporan sintetis. Pencarian, filter status/urgensi/kategori, dan pagination disimpan pada URL.

Untuk memeriksa state kosong, error, atau loading pada mode development, set `REPORTS_MOCK_SCENARIO` menjadi `empty`, `error`, atau `slow` di `.env.local`, lalu mulai ulang server. Nilai default adalah `normal`. Skenario tersebut diabaikan pada build production.

Pada detail laporan berstatus menunggu verifikasi, pilih **Verifikasi laporan** atau **Tolak laporan**, isi alasan, lalu simpan. Badge dan riwayat akan berubah di layar setelah simulasi berhasil; muat ulang halaman untuk kembali ke fixture awal. Untuk menguji proses lambat atau gagal, set `REPORTS_MOCK_MUTATION_SCENARIO=slow` atau `error` di `.env.local` dan mulai ulang server. Laporan pertama memiliki deskripsi panjang dan ringkasan kosong; laporan kelima memiliki riwayat status panjang. Lokasi mock hanya berupa teks tanpa koordinat.

Lapisan data berada di `lib/reports.ts`. Mode `api` sengaja tertutup sampai FastAPI memverifikasi access token dan izin admin pada GET/PATCH. Login Supabase pada tahap ini hanya memeriksa identitas untuk dashboard mock; peran dan cakupan desa tetap menjadi tanggung jawab FastAPI. Halaman `/access-denied` menyiapkan tampilan untuk respons `403` pada tahap integrasi.

## Pemeriksaan

```powershell
npm run lint
npx tsc --noEmit
npm run test:reports
npm run test:auth
npm run build
```

Build saat ini memerlukan akses untuk mengambil font Geist melalui `next/font/google`. Jika jaringan memblokir Google Fonts, build dapat gagal meskipun pemeriksaan TypeScript berhasil.
