# Dashboard LaporPak

Dashboard menggunakan Next.js, TypeScript, Tailwind CSS, dan shadcn/ui. Login petugas memakai Supabase Auth. Daftar, detail, dan keputusan petugas dapat memakai data sintetis atau FastAPI sesuai [kontrak API](../../docs/api-contract.md).

## Menjalankan lokal

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` di `.env.local` memakai URL proyek dan **anon key publik** dari Supabase. Jangan menyalin `SUPABASE_SERVICE_ROLE_KEY` atau secret backend. File `.env.local` diabaikan Git.

Untuk menguji login, buat satu akun uji dengan email, kata sandi, dan email terkonfirmasi melalui **Supabase Dashboard → Authentication → Users**. Nonaktifkan **Allow new users to sign up** pada pengaturan Auth. Akun petugas tidak mendaftar sendiri. Masukkan kata sandi langsung di halaman login, bukan di repository atau chat.

## Menguji undangan petugas

1. Pada **Authentication → URL Configuration**, atur **Site URL** ke alamat dashboard yang sedang diuji, misalnya `http://localhost:3000`; tambahkan alamat tersebut ke daftar **Redirect URLs**. Untuk deployment, gunakan domain dashboard yang sebenarnya.
2. Pada **Authentication → Email Templates → Invite user**, arahkan **tombol/tautan utama yang diklik penerima** ke halaman penerimaan aplikasi. Ganti `href="{{ .ConfirmationURL }}"` bawaan pada template, jangan hanya menambahkan tautan kedua. Gunakan:

   ```html
   <a href="{{ .SiteURL }}/invite/accept?token_hash={{ .TokenHash }}">Terima undangan</a>
   ```

3. **Simpan template sebelum mengirim undangan.** Email yang sudah terlanjur dikirim tetap memakai tautan lama. Pada **Authentication → Users**, pilih **Add user → Send invitation** untuk alamat email uji baru yang belum menjadi pengguna.
4. Uji di jendela privat atau logout dahulu dari akun uji lama. Tautan email harus membuka `/invite/accept` dan menampilkan tombol **Terima undangan** milik aplikasi. Jika langsung membuka `/` atau `/reports`, periksa kembali template **Invite user** dan **Site URL**, lalu kirim undangan baru ke alamat email baru. Jangan membagikan URL lengkap karena memuat token.
5. Petugas menekan **Terima undangan**, lalu mengatur kata sandi di `/set-password`. Penerimaan undangan dilakukan setelah tombol ditekan agar pembaca pratinjau email tidak menghabiskan tautan sekali pakai.
6. Muat ulang `/reports`, keluar, lalu masuk lagi memakai kata sandi baru. Jika tautan kedaluwarsa atau gagal, pengelola mengirim undangan baru.

Pengiriman undangan dilakukan dari Supabase Dashboard oleh pengelola. Frontend tidak menyimpan service role key dan tidak mempunyai formulir pendaftaran publik. Mode default `mock` hanya menampilkan laporan sintetis. Saat `REPORTS_DATA_SOURCE=api`, FastAPI saat ini memverifikasi token Supabase, tetapi belum memeriksa akun admin aktif, peran, dan cakupan desa per akun sesuai kontrak. Jangan gunakan mode API untuk data sensitif atau deployment publik sebelum pemeriksaan izin tersebut selesai di backend.

Buka `http://localhost:3000/login`. Tanpa sesi, `/reports` dan detailnya mengarah ke login. Setelah login, sesi bertahan saat halaman dimuat ulang; tombol **Keluar** mengakhiri sesi. Secara default, `REPORTS_DATA_SOURCE=mock` memakai laporan sintetis. Pencarian, filter status/urgensi/kategori, dan pagination disimpan pada URL.

Untuk memeriksa state kosong, error, atau loading pada mode development, set `REPORTS_MOCK_SCENARIO` menjadi `empty`, `error`, atau `slow` di `.env.local`, lalu mulai ulang server. Nilai default adalah `normal`. Skenario tersebut diabaikan pada build production.

Pada detail laporan berstatus menunggu verifikasi, pilih **Verifikasi laporan** atau **Tolak laporan**, isi alasan, lalu simpan. Badge dan riwayat akan berubah di layar setelah simulasi berhasil; muat ulang halaman untuk kembali ke fixture awal. Untuk menguji proses lambat atau gagal, set `REPORTS_MOCK_MUTATION_SCENARIO=slow` atau `error` di `.env.local` dan mulai ulang server. Laporan pertama memiliki deskripsi panjang dan ringkasan kosong; laporan kelima memiliki riwayat status panjang. Lokasi mock hanya berupa teks tanpa koordinat.

Lapisan data berada di `lib/reports.ts`. Set `REPORTS_DATA_SOURCE=api` untuk
menggunakan GET/detail/PATCH FastAPI. Pemanggilan dilakukan server-side dan
meneruskan access token Supabase milik sesi petugas; dashboard tidak menyimpan
secret backend dan tidak membaca tabel laporan langsung dari Supabase.
`/access-denied` menyiapkan tampilan untuk respons `403`.

## Pemeriksaan

```powershell
npm run lint
npx tsc --noEmit
npm run test:reports
npm run test:auth
npm run build
```

Build saat ini memerlukan akses untuk mengambil font Geist melalui `next/font/google`. Jika jaringan memblokir Google Fonts, build dapat gagal meskipun pemeriksaan TypeScript berhasil.
