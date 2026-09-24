export type TourStep = { title: string; body: string; target?: string };
export type PageGuide = { title: string; steps: TourStep[] };

export const TOUR_VERSION = 1;
export const tourStorageKey = (accountId: string) => `laporpak:admin-tour:v${TOUR_VERSION}:${accountId}`;

export function introSteps(active: boolean, mobile: boolean): TourStep[] {
  const steps: TourStep[] = [{
    title: "Halo, saya maskot LaporPak!",
    body: active
      ? "Saya akan menunjukkan tempat memantau layanan desa. Panduan ini hanya menjelaskan layar dan tidak mengubah data."
      : "Mari kenali portal desa. Lengkapi Pengaturan Akun dan ajukan aktivasi sebelum layanan warga dapat digunakan.",
  }];
  if (mobile) {
    steps.push({ title: "Menu layanan", body: "Ketuk tombol menu ini setelah tur untuk membuka Dashboard, Laporan warga, Pengajuan layanan, dan Pengaturan Akun.", target: '[data-guide="mobile-menu"]' });
  } else {
    steps.push(
      { title: "Dashboard Desa", body: "Ringkasan layanan dan pekerjaan yang perlu perhatian ada di sini. Angkanya berasal dari data desa Anda.", target: '[data-guide="nav-dashboard"]' },
      { title: "Laporan warga", body: "Cari laporan, periksa bukti dan riwayatnya, lalu catat keputusan petugas yang berwenang.", target: '[data-guide="nav-reports"]' },
      { title: "Pengajuan layanan", body: "Tinjau pengajuan layanan dan status keputusan dari desa Anda.", target: '[data-guide="nav-requests"]' },
      { title: "Pengaturan Akun", body: active ? "Atur profil desa, kop dokumen, AI, WhatsApp, dan Sumber ASK dari sini." : "Mulai dari sini: lengkapi profil dan ajukan aktivasi desa.", target: '[data-guide="nav-settings"]' },
    );
  }
  steps.push({ title: "Panduan selalu tersedia", body: "Gunakan Bantuan halaman untuk memahami layar yang sedang dibuka atau mengulang tur awal.", target: '[data-guide="tour-help"]' });
  return steps;
}

export function pageGuide(pathname: string, active: boolean, knowledgeAvailable: boolean): PageGuide {
  if (pathname.startsWith("/reports/settings/knowledge/") && knowledgeAvailable) return {
    title: "Detail Sumber ASK", steps: [
      { title: "Sumber pengetahuan", body: "Baca isi dan status sumber sebelum mengubahnya.", target: '[data-guide="knowledge-detail"]' },
      { title: "Edit sumber", body: "Perbarui informasi layanan yang digunakan asisten saat menjawab warga.", target: '[data-guide="knowledge-edit"]' },
      { title: "Review sumber", body: "Keputusan review menentukan apakah sumber siap digunakan. Periksa isi sebelum menyetujui.", target: '[data-guide="knowledge-review"]' },
      { title: "Riwayat review", body: "Setiap keputusan dan alasannya dapat ditelusuri di sini.", target: '[data-guide="knowledge-history"]' },
    ],
  };
  if (pathname.startsWith("/reports/settings/knowledge") && knowledgeAvailable) return {
    title: "Sumber ASK", steps: [
      { title: "Tambah sumber", body: "Masukkan informasi resmi desa agar asisten dapat menjawab pertanyaan warga dengan rujukan.", target: '[data-guide="knowledge-add"]' },
      { title: "Daftar sumber", body: "Periksa status pemrosesan dan review. Buka satu sumber untuk mengedit atau menonaktifkannya.", target: '[data-guide="knowledge-list"]' },
    ],
  };
  if (pathname.startsWith("/reports/settings")) return {
    title: "Pengaturan Akun", steps: [
      { title: "Bagian pengaturan", body: knowledgeAvailable ? "Pindah antara Pengaturan Akun dan Sumber ASK melalui dua tab ini." : "Pengaturan akun dan desa tersedia di halaman ini.", target: '[data-guide="settings-tabs"]' },
      { title: "Identitas akun", body: "Periksa nama dan kontak penanggung jawab. Email terverifikasi tidak diubah dari formulir ini.", target: '[data-guide="settings-account"]' },
      { title: "Profil desa", body: "Isi wilayah, alamat, kontak, jam layanan, dan logo resmi. Data ini juga dipakai pada kop dokumen.", target: '[data-guide="settings-village"]' },
      { title: "Pratinjau kop", body: "Periksa tampilan kop sebelum menyimpan. Pratinjau dapat memuat perubahan yang belum disimpan.", target: '[data-guide="settings-letterhead"]' },
      { title: "Personalisasi AI", body: "Atur nama dan gaya sapaan asisten desa. Keputusan administratif tetap dibuat petugas.", target: '[data-guide="settings-ai"]' },
      { title: "Simpan pengaturan", body: "Simpan perubahan dan tunggu pesan hasil. Bila unggah logo gagal, lihat status tiap bagian sebelum mencoba lagi.", target: '[data-guide="settings-save"]' },
      { title: "Koneksi WhatsApp", body: "Status berasal dari gateway. Tampilkan QR untuk menautkan perangkat, lalu periksa status terhubung.", target: '[data-guide="settings-whatsapp"]' },
      ...(!active ? [{ title: "Aktivasi desa", body: "Setelah data wajib lengkap, kirim pengajuan aktivasi. Layanan warga aktif setelah disetujui.", target: '[data-guide="settings-activation"]' }] : []),
    ],
  };
  if (/^\/reports\/requests\/[^/]+/.test(pathname)) return {
    title: "Detail pengajuan", steps: [
      { title: "Data pengajuan", body: "Cocokkan tiket dan data pemohon sebelum mengambil keputusan.", target: '[data-guide="request-data"]' },
      { title: "Riwayat keputusan", body: "Lihat perubahan status dan alasan yang sudah dicatat.", target: '[data-guide="request-history"]' },
      { title: "Keputusan petugas", body: "Pilih keputusan dan tulis alasan. Status resmi baru berubah setelah Anda mengonfirmasi dan penyimpanan berhasil.", target: '[data-guide="request-decision"]' },
    ],
  };
  if (pathname.startsWith("/reports/requests")) return {
    title: "Pengajuan layanan", steps: [
      { title: "Antrean pengajuan", body: "Lihat nomor tiket dan status; buka satu pengajuan untuk meninjau detail dan riwayatnya.", target: '[data-guide="request-list"]' },
    ],
  };
  if (pathname.startsWith("/reports/dashboard")) return {
    title: "Dashboard Desa", steps: active ? [
      { title: "Periode ringkasan", body: "Pilih 7, 30, atau 90 hari untuk membandingkan layanan masuk.", target: '[data-guide="dashboard-period"]' },
      { title: "Angka utama", body: "Pantau jumlah laporan, pengajuan, pekerjaan yang perlu tindakan, dan sumber ASK siap pakai.", target: '[data-guide="dashboard-kpis"]' },
      { title: "Butuh tindakan", body: "Antrean ini menampilkan pekerjaan terbaru yang perlu ditinjau petugas.", target: '[data-guide="dashboard-attention"]' },
      { title: "Kondisi layanan", body: "Buka daftar lengkap dari kartu REPORT, REQUEST, atau ASK.", target: '[data-guide="dashboard-status"]' },
    ] : [
      { title: "Desa belum aktif", body: "Lengkapi pengaturan dan periksa status aktivasi untuk membuka ringkasan layanan.", target: '[data-guide="dashboard-inactive"]' },
    ],
  };
  if (/^\/reports\/[^/]+/.test(pathname)) return {
    title: "Detail laporan", steps: [
      { title: "Informasi laporan", body: "Baca uraian dan lokasi warga. Ringkasan serta urgensi dari AI hanya membantu peninjauan.", target: '[data-guide="report-info"]' },
      { title: "Foto laporan", body: "Periksa foto pendukung sebelum mengambil keputusan.", target: '[data-guide="report-photos"]' },
      { title: "Dokumen laporan", body: "Lihat status pembuatan PDF dan pengiriman WhatsApp secara terpisah.", target: '[data-guide="report-documents"]' },
      { title: "Progres rujukan", body: "Pantau tindak lanjut ke unit lain jika laporan perlu dirujuk.", target: '[data-guide="report-referrals"]' },
      { title: "Riwayat status", body: "Keputusan dan perubahan status resmi dapat ditelusuri di sini.", target: '[data-guide="report-history"]' },
      { title: "Aksi petugas", body: "Hanya petugas berwenang yang mengubah status. Tulis alasan dan periksa konfirmasi sebelum menyimpan.", target: '[data-guide="report-decision"]' },
    ],
  };
  return {
    title: "Laporan warga", steps: [
      { title: "Cari dan saring", body: "Gunakan tiket, uraian, lokasi, status, urgensi, atau kategori untuk menemukan laporan.", target: '[data-guide="reports-filter"]' },
      { title: "Daftar laporan", body: "Buka tiket untuk memeriksa detail. Status di daftar selalu berasal dari backend.", target: '[data-guide="reports-list"]' },
      { title: "Halaman berikutnya", body: "Gunakan navigasi ini jika jumlah laporan melampaui satu halaman.", target: '[data-guide="reports-pagination"]' },
    ],
  };
}

export function availableSteps(steps: TourStep[], exists: (selector: string) => boolean): TourStep[] {
  return steps.filter((step) => !step.target || exists(step.target));
}
