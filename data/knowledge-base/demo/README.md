# Sumber sintetis dua desa

Unggah `desa-a.md` ke desa uji A dan `desa-b.md` ke desa uji B melalui pengelolaan Sumber ASK admin yang berwenang. Pilih sumber Markdown, aktif, dan review `demo`; jangan `approved`. Pastikan ID desa dengan tim, tanpa default atau pemetaan otomatis. Jangan memakai importer reviewed karena itu untuk sumber resmi yang disetujui.

Set `ALLOW_DEMO_KNOWLEDGE=true` di backend demo. Jalankan embedding-worker pada host AI dengan secret environment yang sudah terpasang. Pastikan kedua dokumen menjadi `ready` sebelum evaluasi live.

Uji pertanyaan jadwal dan kata penanda. A harus menjawab Senin/ANGGREK, B Rabu/MELATI; keduanya menyertakan label Data simulasi. Tanyakan tarif yang tidak tersedia: harus fallback. Sumber ini belum otomatis diunggah dan belum menjadi bukti retrieval live.
