# Bukti implementasi referral M2

Tanggal pemeriksaan: 22 September 2026

Branch kandidat: `feat/report-referral-m1`

Prasyarat: M1 dan integrasi PostgreSQL development telah lulus.

## Cakupan

- Lima tool operator: konteks kasus, kandidat routing, persiapan draft,
  permintaan dispatch, dan progres referral.
- Tidak ada tool approval atau perubahan status REPORT langsung.
- Capability referral nonaktif secara default dan menolak konteks WhatsApp.
- Bearer token operator diverifikasi FastAPI; scope tetap berasal dari role,
  membership, dan status desa di Supabase.
- Draft selalu menggunakan `share_citizen_identity=false` dan tidak menerima
  aktor, desa, credential, approval flag, atau URL tujuan dari model.
- Schema proposal, prompt clarification, dan tujuh kasus evaluasi stub tersedia.

## Bukti pengujian

| Jenis | Perintah | Hasil |
|---|---|---|
| Plugin contract/unit | `npm test` di plugin | 18 passed |
| Referral behavior stub | `node runner.js --file referral-m2.json --verbose` | 7/7 passed |
| Backend regression | `.venv/Scripts/python.exe -m pytest --basetemp .pytest-m2-temp` | 196 passed |
| Backend lint | `.venv/Scripts/python.exe -m ruff check .` | passed |

Evaluasi `referral-m2.json` bersifat deterministik dan membuktikan aturan tool,
bukan kualitas Gemini. Credential Gemini tersedia di host, tetapi CLI OpenClaw
tidak tersedia pada PATH sesi pemeriksaan sehingga evaluasi model langsung belum
dijalankan. Hasil ini tidak boleh dilaporkan sebagai uji model live.

## Batas

- Tool operator belum diaktifkan pada host mana pun oleh repository; aktivasi
  membutuhkan agent internal terpisah dan token operator berumur pendek.
- Tool tidak dimasukkan ke allowlist agent WhatsApp desa.
- Connector tetap mock; tidak ada request ke instansi nyata.
- M2 belum menambahkan dashboard review, TRACK referral warga, scheduler tugas,
  callback, atau connector pemerintah.
