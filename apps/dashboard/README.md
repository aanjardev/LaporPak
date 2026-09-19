# Dashboard LaporPak

Dashboard menggunakan Next.js, TypeScript, Tailwind CSS, dan shadcn/ui. Login petugas memakai Supabase Auth. REPORT dapat memakai data sintetis atau FastAPI; sumber ASK dan REQUEST memakai FastAPI sesuai [kontrak API](../../docs/api-contract.md).

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

Pengiriman undangan dilakukan dari Supabase Dashboard oleh pengelola. Frontend tidak menyimpan service role key dan tidak mempunyai formulir pendaftaran publik. Mode default `mock` hanya menampilkan laporan sintetis. Saat `REPORTS_DATA_SOURCE=api`, FastAPI memeriksa token Supabase serta akun admin, peran, dan cakupan desa. Pembatasan tersebut tetap perlu dibuktikan lewat uji integrasi nyata sebelum deployment publik.

Buka `http://localhost:3000/login`. Tanpa sesi, `/reports` dan detailnya mengarah ke login. Setelah login, sesi bertahan saat halaman dimuat ulang; tombol **Keluar** mengakhiri sesi. Secara default, `REPORTS_DATA_SOURCE=mock` memakai laporan sintetis. Pencarian, filter status/urgensi/kategori, dan pagination disimpan pada URL.

Untuk memeriksa state kosong, error, atau loading pada mode development, set `REPORTS_MOCK_SCENARIO` menjadi `empty`, `error`, atau `slow` di `.env.local`, lalu mulai ulang server. Nilai default adalah `normal`. Skenario tersebut diabaikan pada build production.

Pada detail laporan, pilih aksi yang tersedia untuk status saat ini: verifikasi/tolak, mulai penanganan, teruskan, atau selesaikan. Semua tindakan memerlukan alasan. Dalam mode mock, badge dan riwayat berubah selama halaman terbuka; muat ulang untuk kembali ke fixture awal. Pada mode API, dashboard membaca ulang detail resmi setelah PATCH berhasil. Untuk menguji proses lambat atau gagal, set `REPORTS_MOCK_MUTATION_SCENARIO=slow` atau `error` di `.env.local` dan mulai ulang server. Laporan pertama memiliki deskripsi panjang dan ringkasan kosong; laporan kelima memiliki riwayat status panjang. Lokasi mock hanya berupa teks tanpa koordinat.

Detail laporan pertama juga memiliki dua foto sintetis untuk menguji galeri. Foto dibaca melalui route Next.js yang memerlukan sesi petugas; pada mode API route tersebut meneruskan token ke [endpoint foto privat FastAPI](../../docs/api-contract.md#read-private-report-attachment). Browser tidak menerima URL atau path bucket privat. Pada layar sempit, foto tersusun satu kolom; petugas dapat membuka gambar lewat tautan **Buka foto**. Integrasi dengan object Supabase Storage nyata tetap harus dibuktikan sesuai checklist P0.

Lapisan data berada di `lib/reports.ts`. Set `REPORTS_DATA_SOURCE=api` untuk
menggunakan GET/detail/PATCH FastAPI. Pemanggilan dilakukan server-side dan
meneruskan access token Supabase milik sesi petugas; dashboard tidak menyimpan
secret backend dan tidak membaca tabel laporan langsung dari Supabase.
`/access-denied` menyiapkan tampilan untuk respons `403`.

## Pengelolaan sumber ASK

Route `/reports/knowledge` menyediakan daftar, tambah, edit, dan penonaktifan
sumber ASK melalui FastAPI. Request dijalankan dari server Next.js dengan token
sesi petugas. Respons `401` mengarah ke login, `403` ke halaman akses ditolak,
`404` detail ke halaman tidak ditemukan, dan kegagalan layanan menampilkan pesan
umum tanpa membocorkan detail internal. Frontend tidak membaca bucket knowledge
atau tabel Supabase secara langsung.

Gunakan data sintetis saat menguji formulir. Sumber baru belum dapat disebut
resmi sampai pemilik konten desa memeriksa isi, versi, cakupan unit, dan status
aktifnya. ASK warga tetap berjalan melalui WhatsApp/OpenClaw.

## REQUEST Surat Keterangan Domisili

Route `/reports/requests` membaca antrean dan detail dari FastAPI. Petugas dapat
menyetujui atau menolak pengajuan `pending_review`, lalu menandai pengajuan
`approved` sebagai `completed`. Semua keputusan memerlukan alasan dan FastAPI
tetap menentukan apakah transisi, peran, dan cakupan desa diizinkan.

Dashboard mempertahankan alasan ketika penyimpanan gagal, mencegah kirim ganda,
dan menampilkan respons `401`, `403`, `404`, `409`, `422`, serta kegagalan
layanan secara aman. Riwayat keputusan sudah disimpan backend, tetapi belum
ditampilkan karena respons detail belum memuatnya. SOP layanan dan kewenangan
petugas tetap harus disahkan sebelum REQUEST digunakan dengan data warga nyata.

## Pemeriksaan

```powershell
npm run lint
npx tsc --noEmit
npm run test:reports
npm run test:knowledge
npm run test:requests
npm run test:auth
npm run build
```

Build saat ini memerlukan akses untuk mengambil font Geist melalui `next/font/google`. Jika jaringan memblokir Google Fonts, build dapat gagal meskipun pemeriksaan TypeScript berhasil.


## Sistem desain dashboard

Panduan visual ada di [docs/design-system.md](../../docs/design-system.md).
Auth, REPORT, REQUEST, dan ASK memakai Plus Jakarta Sans, sidebar navy,
aksen kuning, token semantik Tailwind, dan kontrol minimal 44 px.
Navigasi di bawah 1024 px memakai dialog Base UI (Escape, focus trap, dan
pengembalian fokus ditangani komponen). Halaman awal tetap `/reports`.

Logo berasal dari aset tim; turunan lokal ada di `public/brand/` dan
`app/icon.png`/`app/favicon.ico`. Wordmark memakai `next/image`; foto laporan
tetap melalui proxy privat yang sudah ada. Jangan mengirim foto privat ke
optimizer publik atau mengganti proxy dengan URL Storage langsung.

Audit UI 19 September 2026: pengguna mengonfirmasi tampilan 390/768/1280 px,
menu ponsel/Escape, navigasi, dan tidak adanya overflow aman. Koneksi browser
agent mengalami timeout CDP; hasil manual ini tidak menggantikan pengujian
ulang login, logout, penyimpanan aksi, atau izin backend pada environment nyata.
