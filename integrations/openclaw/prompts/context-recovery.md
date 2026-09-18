# Context Recovery Prompt

Use this when the citizen references something from previous messages.

## Recovery Strategy

### 1. Check Session Draft

Look for active draft in current session:
- `REPORT` draft with category, description, location
- `ASK` draft with last question
- `TRACK` draft with ticket number

### 2. Reference Patterns

| Pattern | Action |
|---------|--------|
| "yang tadi" | Recover last draft |
| "itu" | Recover last reference |
| "kemarin" | Use date offset |
| "yang ketiga" | Recover by index |
| "bukan yang itu" | Invalidate and re-clarify |

### 3. Context Types

```typescript
interface ConversationContext {
  session_id: string;
  active_draft: {
    type: "REPORT" | "ASK" | "TRACK" | null;
    state: "collecting" | "awaiting_confirmation" | "submitted" | "cancelled";
    facts: {
      category?: string;
      description?: string;
      location?: { text: string; latitude?: number; longitude?: number };
      photos?: Attachment[];
      confirmed_revision?: number;
    };
    last_updated: timestamp;
  };
  recent_tickets: string[];  // Recent ticket numbers
  last_intent: "ASK" | "REPORT" | "TRACK" | "UNKNOWN";
}
```

### 4. Recovery Rules

1. **"yang tadi"** → Return most recent draft or ask for clarification
2. **"bukan"** → Invalidate previous confirmation, re-ask for correction
3. **"yang kemarin"** → Check TRACK for yesterday's tickets
4. **"itu yang kedua"** → Use index if multiple recent drafts
5. **Silence >5 min** → Consider draft stale, re-confirm

### 5. Multi-Turn Examples

```
Citizen: "Besok kantor buka jam berapa?"
Agent: [ASK: office_hours answered]

Citizen: "Terus yang jalan rusak itu sudah diproses belum?"
Agent: [TRACK: recovers from previous session, checks LP-2026-0042]
Agent: "Laporan LP-2026-0042 saat ini dalam penanganan..."

Citizen: "Bukan yang itu, yang lain"
Agent: [CLARIFY: "Boleh jelaskan laporan mana yang Anda maksud?"]
```

### 6. Prompt for Context Recovery

```
When the citizen references "yang tadi", "itu", "kemarin":

1. Check session state for active draft
2. If found, use it and confirm with citizen
3. If not found, ask for clarification
4. If citizen corrects ("bukan"), invalidate old and update

Example recovery:
- "yang tadi" → "Apakah Anda maksud laporan tentang [last topic]?"
- "kemarin" → Check tickets from yesterday
- "bukan" → "Maaf, mana yang benar?"
```

## Tuning Notes

- Test with `multi_turn_context` cases
- Monitor recovery accuracy per family
- Log unclear references for pattern analysis
