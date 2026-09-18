# Date/Time Extraction for TRACK

Extract and normalize temporal references from citizen messages.

## Common Patterns

| Pattern | Meaning | Normalized |
|---------|---------|------------|
| "kemarin" | yesterday | today - 1 day |
| "kemarin lusa" | day before yesterday | today - 2 days |
| "besok" | tomorrow | today + 1 day |
| "lusa" | day after tomorrow | today + 2 days |
| "dua hari lalu" | two days ago | today - 2 days |
| "seminggu lalu" | a week ago | today - 7 days |
| "bulan lalu" | last month | this month - 1 |
| "tahun lalu" | last year | this year - 1 |
| "minggu ini" | this week | current week |
| "bulan ini" | this month | current month |
| "tahun ini" | this year | current year |
| "Senin" | next Monday | next monday date |
| "tadi" | just now | recent |

## Extraction Rules

### Relative Time

```javascript
const relativePatterns = {
  "kemarin": -1,
  "kemarin lusa": -2,
  "lusa": -2,
  "dua hari lalu": -2,
  "tiga hari lalu": -3,
  "sehari lalu": -1,
  "besok": +1,
  "lusa": +2,
  "dua hari lagi": +2,
  "tiga hari lagi": +3,
  "seminggu lalu": -7,
  "sepekan lalu": -7,
  "sebulan lalu": -30,
  "sebulan": -30,
  "setahun lalu": -365,
  "setahun": -365,
};
```

### Day Names

```javascript
const dayPatterns = {
  "senin": "Monday",
  "selasa": "Tuesday",
  "rabu": "Wednesday",
  "kamis": "Thursday",
  "jumat": "Friday",
  "sabtu": "Saturday",
  "minggu": "Sunday",
  "hari senin": "Monday",
};
```

### Time Ranges

```javascript
const timePatterns = {
  "tadi": "recent",
  "barusan": "recent",
  "baru": "recent",
  "kemarin pagi": "yesterday morning",
  "kemarin sore": "yesterday afternoon",
  "kemarin malam": "yesterday night",
  "tadi pagi": "this morning",
  "tadi sore": "this afternoon",
};
```

## Extraction Prompt

```
Extract temporal references from citizen message:

1. Look for relative time words: "kemarin", "besok", "tadi"
2. Look for day names: "Senin", "Selasa", etc.
3. Look for ranges: "dua hari", "seminggu"
4. Normalize to dates

Examples:
- "kemarin" → date = today - 1 day
- "besok" → date = today + 1 day
- "Senin" → next occurrence of Monday
- "minggu lalu" → most recent Sunday

Return:
{
  has_temporal: true/false,
  original: "kemarin",
  normalized: date,
  confidence: 0.0-1.0
}
```

## Usage in TRACK

### Input

```
Citizen: "Laporan saya kemarin bagaimana?"
```

### Extraction

```
{
  "has_temporal": true,
  "original": "kemarin",
  "normalized": "2026-09-16",
  "confidence": 0.95
}
```

### Query

```sql
SELECT * FROM reports
WHERE citizen_id = :citizen_id
  AND created_at >= :yesterday
  AND created_at < :today
ORDER BY created_at DESC
LIMIT 5
```

## Implementation

### Python Helper

```python
from datetime import datetime, timedelta
import re

def extract_temporal(text: str) -> dict | None:
    """Extract temporal references from text."""
    today = datetime.now().date()

    patterns = {
        r"kemarin": lambda: today - timedelta(days=1),
        r"kemarin\s*lusa": lambda: today - timedelta(days=2),
        r"lusa": lambda: today + timedelta(days=2),
        r"besok": lambda: today + timedelta(days=1),
        r"dua?\s*hari\s*lalu": lambda: today - timedelta(days=2),
        r"tiga?\s*hari\s*lalu": lambda: today - timedelta(days=3),
        r"seminggu\s*lalu": lambda: today - timedelta(days=7),
        r"sebulan\s*lalu": lambda: today - timedelta(days=30),
        r"setahun\s*lalu": lambda: today - timedelta(days=365),
    }

    for pattern, get_date in patterns.items():
        if re.search(pattern, text):
            return {
                "original": re.search(pattern, text).group(),
                "normalized": get_date(),
                "confidence": 0.9
            }

    return None
```

## Tuning Notes

- Start with common patterns only
- Add regional variations as needed
- Log unparsed patterns for analysis
- Track extraction accuracy
