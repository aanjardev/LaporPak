# Intent Chain Detection

Detect and handle transitions between ASK, REPORT, and TRACK within one conversation.

## Intent Flow Diagram

```
                    ┌─────────┐
                    │  ASK    │
                    └────┬────┘
                         │
          ┌──────────────┼──────────────┐
          ↓              ↓              ↓
     ┌────────┐    ┌─────────┐   ┌────────┐
     │ ASK→ASK│    │ASK→REPORT│  │ASK→TRACK│
     └────────┘    └─────────┘   └────────┘
          ↑              │              │
          │              ↓              ↓
          │         ┌─────────┐   ┌─────────┐
          └─────────│REPORT→ASK│  │TRACK→ASK│
                    └─────────┘   └─────────┘
                         │              │
                         ↓              ↓
                    ┌─────────┐   ┌─────────┐
                    │REPORT→REPORT│ │TRACK→TRACK│
                    └─────────┘   └─────────┘
```

## Chain Patterns

### ASK → REPORT (Common)

```
Citizen: "Mau tanya soal KTP"
Agent: [ASK answered]

Citizen: "Oh iya, terus saya mau laporkan jalan rusak"
→ Transition to REPORT
→ Keep ASK context for reference
→ Preserve session
```

### ASK → TRACK (Common)

```
Citizen: "Kapan kantor buka?"
Agent: [ASK answered]

Citizen: "Terus laporan saya yang kemarin bagaimana?"
→ Transition to TRACK
→ Check recent tickets
```

### REPORT → ASK (Interrupt)

```
Citizen: [Reporting road damage, location missing]

Agent: "Bisa disebutkan lokasinya?"

Citizen: "Omong-omong, besok kantor buka jam berapa?"
→ Answer ASK, return to REPORT draft
→ Preserve report draft
→ Don't lose collected facts
```

### REPORT → REPORT (Correction)

```
Citizen: "Jalan rusak di RT 03"
Agent: "Lokasinya di mana?"

Citizen: "Oh, maksud saya di RT 04"
→ Correct location
→ Re-confirm all facts
```

### TRACK → REPORT (New Report)

```
Citizen: "LP-2026-0042 sudah selesai?"
Agent: [TRACK answered]

Citizen: "Oke, terus saya mau bikin laporan baru"
→ Start new REPORT
→ Don't confuse with old ticket
```

## Transition Rules

| From | To | Action |
|------|-----|--------|
| ASK | ASK | Extend context, refine question |
| ASK | REPORT | Create draft, preserve ASK |
| ASK | TRACK | Query recent tickets |
| REPORT | ASK | Answer, return to draft |
| REPORT | REPORT | Update draft |
| REPORT | TRACK | Check ticket, return to draft |
| TRACK | ASK | Answer, return to context |
| TRACK | REPORT | Start new draft |
| TRACK | TRACK | Extend search |

## State Preservation

When transitioning:

1. **Preserve collected facts** - Don't lose partial REPORT data
2. **Mark intent timestamp** - Know when transition happened
3. **Return to previous** - After ASK interrupt, continue REPORT
4. **Clear on submit** - After REPORT submit, fresh state

## Multi-Turn State Machine

```typescript
interface SessionState {
  current_intent: "ASK" | "REPORT" | "TRACK" | "UNKNOWN";
  report_draft: ReportDraft | null;
  ask_history: Question[];
  track_history: TrackedTicket[];
  pending_confirmation: boolean;
  transition_log: Transition[];
}

interface Transition {
  from: Intent;
  to: Intent;
  timestamp: Date;
  trigger: string;  // "citizen_request" | "system_needed"
}
```

## Prompt for Intent Chain

```
Detect intent transitions:

1. If citizen switches topic mid-conversation, detect transition
2. Preserve draft facts when answering ASK interrupts
3. Return to previous intent after answering questions
4. Log transitions for analysis

Example transitions:
- "Terus" → Continue previous intent
- "Oh iya" → Add new request to same intent
- "Btw" / "Ngomong-ngomong" → Interrupt with new intent
```

## Tuning Notes

- Track transition frequency per session
- Monitor drafts lost during transitions
- Test with `multi_turn_intent_transition` cases
