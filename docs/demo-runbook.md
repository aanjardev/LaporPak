# Runbook demo end-to-end LaporPak

Gunakan data sintetis. Jangan menaruh Gemini key, API key, token Supabase,
nomor WhatsApp pribadi, QR, atau percakapan warga di Git dan bukti demo.

## 1. Baseline

Gunakan commit `main` yang sama, terapkan seluruh migration dan seed, lalu
jalankan FastAPI dan dashboard dengan `REPORTS_DATA_SOURCE=api`. Pastikan
`/health` mengembalikan `200`.

```powershell
cd services/api
uv run pytest
uv run ruff check .

cd ../../apps/dashboard
npm run test:reports
npm run test:knowledge
npm run test:requests
npm run test:auth
npm run lint
npm run build

cd ../../integrations/openclaw/plugins/laporpak-tools
npm test
```

## 2. OpenClaw dan WhatsApp

OpenClaw terbaru membutuhkan Node.js 24.16+ atau 26.1+. Pada Windows, gunakan
installer resmi bila runtime lokal belum memenuhi syarat:

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
openclaw onboard --install-daemon
```

Simpan hanya pada environment host OpenClaw:

```env
GEMINI_API_KEY=
LAPORPAK_API_URL=http://127.0.0.1:8000
LAPORPAK_API_KEY=
LAPORPAK_CHANNEL_ACCOUNT_ID=
```

Install plugin WhatsApp dan plugin LaporPak dari checkout lokal. Izinkan hanya
tool REPORT, ASK, TRACK, REQUEST, emergency, similarity, dan confirmation milik
plugin LaporPak.

```powershell
openclaw plugins install @openclaw/whatsapp
openclaw channels login --channel whatsapp
openclaw doctor
openclaw config validate
openclaw gateway health
openclaw channels status --probe
```

Gunakan pairing atau `allowFrom` untuk nomor uji. Nilai
`LAPORPAK_CHANNEL_ACCOUNT_ID` harus sama dengan
`channel_integrations.external_account_id` yang aktif pada desa uji.

## 3. Urutan demo

1. Kirim REPORT belum lengkap; bot harus meminta lokasi dan foto.
2. Kirim foto, konfirmasi ringkasan, dan catat tiket `LP-*`.
3. Kirim konfirmasi yang sama lagi; jumlah tiket harus tetap satu.
4. Buka dashboard, lihat foto melalui proxy sesi, lalu selesaikan status.
5. TRACK tiket dari nomor pemilik dan cocokkan status resmi.
6. Jalankan ASK tercakup dan di luar knowledge; kasus kedua wajib fallback.
7. Buat REQUEST domisili, putuskan oleh admin, lalu TRACK tiket `REQ-*`.
8. Ulangi akses memakai admin/nomor desa lain; akses silang harus gagal.
9. Matikan FastAPI sementara; bot tidak boleh mengklaim operasi berhasil.

## 4. Bukti selesai

Catat tanggal, SHA, lingkungan, tiket sintetis, hasil aman, dan batas uji.
Jangan mencatat token, nomor lengkap, storage path, atau payload gambar. Demo
selesai setelah REPORT, ASK, TRACK, REQUEST, foto privat, keputusan manusia,
idempotensi, dan isolasi desa diamati pada komponen nyata.
