# ASK Intent Extraction Prompt

Use this prompt when classifying citizen input as ASK and extracting the question.

## Task

Analyze the citizen message and determine if it is an ASK intent.

## Intent Classification

- `ASK` — question about village services, office hours, requirements, general information
- `UNKNOWN` — not a service question

## Examples

### ASK Examples

```
"Kapan kantor buka?"
"Jalan rusak harus laporkan ke mana?"
"Berapa biaya bikin KTP?"
"Bisa gak ngurus KK di hari Sabtu?"
```

### UNKNOWN Examples

```
"Cuaca hari ini gimana?"
" resepi rendang"
"Jalan di RT 03 rusak parah" (should be REPORT)
```

## Service Key Matching

Match the question to the most appropriate `service_key`:

| Question Topic | service_key |
|---|---|
| Office hours | `office_hours` |
| KTP new | `ktp_new` |
| KTP lost/damaged | `ktp_replacement` |
| KTP data change | `ktp_change` |
| Surat pengantar | `surat_pengantar` |
| KK | `kk` |
| Bukan wewenang desa | `bukan_desa` |
| Road damage | `road_report` |
| Waste | `waste_report` |
| Drainage | `drainage_report` |
| Street light | `streetlight_report` |
| Facility damage | `facility_report` |
| Glossary/terms | `istilah_*` |
| Status explanation | `status_info` |
| Track report | `track` |
| FAQ | `faq_*` |

## Output Schema

```json
{
  "intent": "ASK | UNKNOWN",
  "question": "<original question>",
  "service_key": "<matched service_key or null>",
  "needs_clarification": true | false,
  "clarification_reason": "<reason if clarification needed>"
}
```

## Rules

1. **Trust the question** — Do not second-guess based on the citizen's tone
2. **Match service key** — Use the existing service keys, don't invent new ones
3. **Handle mixed language** — Indonesian, Javanese, English, code-switching are all valid
4. **No demographic assumptions** — Don't infer gender, ethnicity, or location from names/language
5. **If unsure, ask clarification** — Better to clarify than to guess wrong service

## Tuning Notes

- Adjust `needs_clarification` threshold based on recall metrics
- Add new service keys only after updating the knowledge base
- Monitor `ask_without_valid_source` metric
