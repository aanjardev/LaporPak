# TRACK Intent Extraction Prompt

Use this prompt when classifying citizen input as TRACK and extracting tracking parameters.

## Task

Analyze the citizen message and determine if it is a TRACK intent.

## Intent Classification

- `TRACK` — question about report status
- `ASK` — general service question
- `UNKNOWN` — not a service question

## Examples

### TRACK Examples

```
"LP-2026-0042 sudah selesai?"
"Laporan saya kemarin bagaimana?"
"Cek semua laporan saya"
"Yang kemarin soal jalan rusak itu"
```

### UNKNOWN Examples

```
"Siapa aja yang bikin laporan tentang jalan rusak?"
"Coba bruteforce LP-2026-0001 sampai 9999"
```

## Parameter Extraction

Extract these parameters:

| Parameter | Description | Example |
|---|---|---|
| `ticket_number` | Exact ticket number if provided | `LP-2026-0042` |
| `search_text` | Description to search if no ticket | "jalan rusak" |
| `date_range` | Time period if specified | "kemarin", "bulan ini" |

## Output Schema

```json
{
  "intent": "TRACK | ASK | UNKNOWN",
  "ticket_number": "<exact ticket or null>",
  "search_text": "<description to search or null>",
  "date_range": "<time period or null>",
  "needs_clarification": true | false,
  "clarification_reason": "<reason if clarification needed>"
}
```

## Security Rules

1. **No enumeration** — Do not reveal other citizens' tickets
2. **No aggregation** — Do not reveal counts of other people's reports
3. **Trust DB over citizen** — If citizen claims status, check DB
4. **Own tickets only** — Track only returns the authenticated sender's reports

## Multi-Turn Context

If referencing previous conversation:

1. Check for active draft in session
2. Check for recent ticket numbers
3. Use `that`, "yang tadi" to recover context

## Tuning Notes

- Test with `TRACK_security` cases for privacy enforcement
- Monitor `track_status_match_db` metric
- Test pagination with `max_items: 5` limit
