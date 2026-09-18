# Smart Clarification Prompt

Order of clarification questions affects completion rate and user experience.

## Clarification Priority

### For REPORT

| Priority | Field | Question | Why First |
|----------|-------|----------|-----------|
| 1 | **Location** | "Bisa disebutkan lokasinya?" | Hardest to infer, most impactful |
| 2 | **Category** | "Jenis masalah apa? (Infrastruktur/Kebersihan/Keamanan)" | Determines routing |
| 3 | **Description** | "Bisa jelaskan lebih detail?" | Clarifies the issue |
| 4 | **Photo** | "Bisa kirim foto bukti?" | Required for verification |

### For ASK

| Priority | Field | Question |
|----------|-------|----------|
| 1 | **Topic** | "Pertanyaan Anda tentang apa?" |
| 2 | **Specifics** | Follow-up based on topic |

## Question Templates

### Location Clarification

```
Terserah preferensi warga:
- "Bisa disebutkan lokasinya di mana?"
- "Lokasinya di area mana?"
- "apatokan terdekat di mana?"

Jika ambigu:
- "Dekat patokan apa?"
- "Nama jalan atau RT/RW-nya?"
```

### Category Clarification

```
Jika multiple categories mungkin:
- "Jenis masalah apa yang Anda alami?"
- "Lebih ke masalah infrastruktur, kebersihan, atau keamanan?"

Opsi:
- Infrastruktur (jalan, drainase)
- Kebersihan (sampah)
- Keamanan (gangguan)
- Fasilitas umum (lampu, taman)
- Lainnya
```

### Photo Request

```
Setelah data lengkap, minta foto:
"Untuk加快 proses, bisa kirim foto bukti?"

Jika warga kesulitan:
- "Bisa kirim foto dari HP?"
- "Foto dari kamera apa saja bisa"
```

## Decision Tree

```
START: Citizen message
  ↓
Extract: category, location, description
  ↓
Missing fields?
  ├─ YES → Ask missing (priority order)
  └─ NO → Confirm with citizen
  ↓
Photo present?
  ├─ YES → Ready for confirmation
  └─ NO → Request photo
  ↓
Confirmed?
  ├─ YES → Create report
  └─ NO → Re-confirm
```

## Tuning Notes

- Test with `missing_*` cases
- Track clarification count per session
- Aim for ≤3 clarifications per report
