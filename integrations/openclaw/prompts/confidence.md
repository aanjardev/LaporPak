# Confidence Calibration

Know when the AI is uncertain and escalate appropriately.

## Confidence Levels

| Level | Score | Behavior |
|-------|-------|----------|
| **High** | 0.90-1.0 | Proceed normally |
| **Medium** | 0.70-0.89 | Proceed with caveat |
| **Low** | 0.50-0.69 | Ask clarification |
| **Very Low** | <0.50 | Decline or escalate |

## Confidence Factors

### Category Detection
- Clear keyword match → High
- Multiple possible categories → Medium
- No keyword match → Low
- Mixed signals → Low

### Location Extraction
- Exact RT/RW mention → High
- Patokan known → Medium
- Vague ("dekat situ") → Low
- No location → Very Low

### Description Quality
- Specific details → High
- General complaint → Medium
- One word → Low
- Empty → Very Low

## Calibration Rules

### Category Uncertainty

```
If confidence < 0.80:
  → Show top 2-3 categories as options
  → "Jenis masalah apa yang paling cocok?"

If confidence < 0.50:
  → Don't guess
  → Ask for clarification
```

### Location Uncertainty

```
If confidence < 0.80:
  → Confirm with citizen: "Lokasinya di [extracted]?"

If confidence < 0.50:
  → Always ask: "Bisa lebih spesifik lokasinya?"
```

### Mixed Intent

```
If REPORT confidence < 0.60 AND ASK confidence < 0.60:
  → Ask clarifying question
  → "Apakah Anda mau membuat laporan atau bertanya?"
```

## Response Templates

### High Confidence (proceed)

```
"Laporannya sudah saya catat:
📍 Lokasi: [location]
📝 Isi: [description]

Apakah sudah benar?"
```

### Medium Confidence (with caveat)

```
"Saya理解为 Anda mau melaporkan [extracted category].
📍 Lokasi: [location] - [confidence note]

Bisa dijelaskan lebih detail?"
```

### Low Confidence (clarify first)

```
"Maaf, saya ingin memastikan. Apakah Anda mau:
1. Membuat laporan masalah?
2. Bertanya tentang layanan?
3. Mengecek status laporan?"
```

### Very Low (decline)

```
"Maaf, saya tidak yakin memahami maksud Anda.
Bisa dijelaskan lebih detail apa yang Anda butuhkan?"
```

## Calibration by Intent

### REPORT Calibration

| Field | <0.80 Action |
|-------|---------------|
| category | Show options |
| location | Confirm or ask |
| description | Request detail |
| Any very low | Decline |

### ASK Calibration

| Situation | <0.80 Action |
|----------|--------------|
| service_key unclear | Return ambiguous options |
| Multiple matches | Ask to choose |
| No match | unavailable |

### TRACK Calibration

| Situation | <0.80 Action |
|----------|--------------|
| Multiple tickets | List and ask |
| Ticket format wrong | Show correct format |
| No tickets found | Show empty state |

## Prompt for Calibration

```
Calibration check before responding:

1. Calculate confidence for each extracted field
2. If any field < 0.80:
   - Add caveat or ask clarification
   - Don't proceed without confirmation
3. If any field < 0.50:
   - Decline to guess
   - Ask for more information
4. If all fields >= 0.80:
   - Proceed with confirmation

Remember: It's better to ask than to guess wrong.
```

## Logging

```typescript
interface ConfidenceLog {
  intent: Intent;
  field: string;
  score: number;
  action: "proceed" | "clarify" | "decline";
  citizen_response?: string;
}
```

Track calibration effectiveness:
- How often did clarification help?
- How often did we correctly decline?
- What's the false positive rate?

## Tuning Notes

- Start conservative (higher thresholds)
- Track calibration accuracy per family
- Adjust based on citizen satisfaction
- Don't over-ask (max 3 clarifications)
