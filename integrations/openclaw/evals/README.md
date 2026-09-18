# AI Engineering Testing Guide

> Complete guide for testing LaporPak AI components.

## Quick Start

```powershell
# Run all AI tests
.\ai-test-runner.ps1 -All

# Run specific test
.\ai-test-runner.ps1 -FTS          # FTS recall test
.\ai-test-runner.ps1 -Evals        # Evaluation runner
.\ai-test-runner.ps1 -Gaps         # Gap analysis
.\ai-test-runner.ps1 -Suite        # Full test suite

# With verbose output
.\ai-test-runner.ps1 -All -Verbose

# Generate HTML report
.\ai-test-runner.ps1 -All -Report
```

Or using Node directly:

```bash
cd integrations/openclaw/evals
node fts-recall.js                          # FTS recall
node runner.js                              # All evals
node runner.js --family REPORT              # Specific family
node gap-tracker.js --list                  # List gaps
node test-suite.js                          # Test suite
```

---

## Test Tools

### 1. FTS Recall Test (`fts-recall.js`)

Tests knowledge base retrieval quality.

```bash
node fts-recall.js
node fts-recall.js --verbose
```

**Target:** Recall@5 ≥ 90%

**What it tests:**
- Office hours queries
- KTP administration queries
- Waste/drainage/road reports
- Glossary lookups
- Crosslingual coverage
- Mixed language queries

---

### 2. Evaluation Runner (`runner.js`)

Runs evaluation datasets against the AI system.

```bash
node runner.js                              # All datasets
node runner.js --family REPORT             # Specific family
node runner.js --file ask-p0.json         # Specific file
node runner.js --count 10                 # Limit cases
node runner.js --verbose                   # Detailed output
node runner.js --output results.json       # Save results
```

**Datasets:**
| Dataset | Cases | Purpose |
|---------|-------|---------|
| `report-p0.json` | 29 | REPORT extraction |
| `ask-p0.json` | 42 | ASK classification |
| `track-p0.json` | 29 | TRACK extraction |
| `error-attack-p0.json` | 52 | Security/behavior |
| `e2e-flow.json` | 1 | End-to-end |

---

### 3. Gap Tracker (`gap-tracker.js`)

Tracks unanswered questions for knowledge base expansion.

```bash
# Add new gap
node gap-tracker.js --add "Bansos kemana?" bukan_desa

# List gaps
node gap-tracker.js --list
node gap-tracker.js --list --pending

# Analyze patterns
node gap-tracker.js --analyze

# Export for editor
node gap-tracker.js --export > gaps.md

# Resolve gap
node gap-tracker.js --resolve gap-123 "Added to KB"

# Show stats
node gap-tracker.js --stats
```

---

### 4. Test Suite (`test-suite.js`)

Runs all AI tests in sequence.

```bash
node test-suite.js
node test-suite.js --fts
node test-suite.js --evals
node test-suite.js --gaps
node test-suite.js --report
```

---

## Metrics Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Simulated alias recall@5 | ≥90% | 100% | ✅ Pass |
| Routing Macro-F1 | ≥0.90 | - | ⬜ Need eval |
| Hybrid regression suite | ≥90% | 153/153 | ✅ Pass |
| Context Leak | 0 | - | ⬜ Need eval |
| Latency p95 | ≤10s | - | ⬜ Need runtime |
| AI Status Mutation | 0 | - | ⬜ Need eval |
| Ticket Without Photo | 0 | ✅ | ✅ Verified |

---

## Scenario Families

### REPORT Families
- `REPORT` - Complete reports
- `security` - Prompt injection, SQL injection
- `multi_turn` - Context, corrections, confirmations

### ASK Families (13)
- `ASK_administration_office` - Office hours
- `ASK_administration_ktp` - KTP related
- `ASK_administration_surat` - Letter requests
- `ASK_administration_kk` - Family cards
- `ASK_administration_bukan_desa` - Non-village affairs
- `ASK_environment_road` - Road reports
- `ASK_environment_waste` - Waste management
- `ASK_environment_drainage` - Drainage issues
- `ASK_environment_streetlight` - Street lighting
- `ASK_environment_facility` - Public facilities
- `ASK_glossary` - Term definitions
- `ASK_status` - Status explanations
- `ASK_unknown` - Non-service questions

### TRACK Families
- `TRACK` - Basic tracking
- `TRACK_security` - Privacy enforcement
- `TRACK_multi_turn` - Context recovery

### Error/Attack Families (21)
- `security_injection` - Prompt injection
- `security_enumeration` - Ticket enumeration
- `security_data_theft` - Data theft attempts
- `security_privilege_escalation` - Privilege escalation
- `security_availability` - Flood/DoS
- `behavior_urgency` - Urgency exaggeration
- `behavior_trust_db` - DB vs citizen trust
- `behavior_intent_confusion` - Intent classification
- `behavior_language` - Language handling
- `behavior_emotion` - Emotional responses
- `behavior_greeting` - Greeting handling
- `multi_turn_context` - Context recovery
- `multi_turn_intent_transition` - Intent transitions
- `multi_turn_correction` - Draft corrections
- `multi_turn_idempotency` - Duplicate handling
- `multi_turn_cancel` - Cancellation handling
- `multi_turn_long` - Long context
- `ask_source_conflict` - Conflicting sources
- `ask_expired` - Expired information
- `ask_handoff` - Handoff handling
- `simulation_production` - Simulation awareness

---

## Adding Test Cases

### Add to REPORT eval
Edit `evals/report-p0.json`:
```json
{
  "id": "new_case_01",
  "scenario_family": "REPORT",
  "citizen_text": "Jalan di depan SD rusak.",
  "expected": {
    "intent": ["REPORT"],
    "category": ["infrastructure"],
    "needs_clarification": [false],
    "facts": ["jalan", "SD", "rusak"]
  }
}
```

### Add to ASK eval
Edit `evals/ask-p0.json`:
```json
{
  "id": "new_ask_01",
  "scenario_family": "ASK_administration_office",
  "citizen_text": "Kapan tutup?",
  "expected": {
    "intent": ["ASK"],
    "has_answer": true,
    "source_service_key": "office_hours"
  }
}
```

### Add knowledge gap
```bash
node gap-tracker.js --add "Pertanyaan warga?" service_key
```

---

## Troubleshooting

### "Node.js not found"
Install Node.js from https://nodejs.org

### "API not reachable"
Make sure FastAPI is running:
```powershell
cd services\api
uv run uvicorn app.main:app --reload
```

### "Permission denied"
Make sure you're in the correct directory.

### "Module not found"
Run from the correct path:
```bash
cd integrations/openclaw/evals
node fts-recall.js
```

---

## CI/CD Integration

Add to your CI pipeline:

```bash
# In CI environment
cd integrations/openclaw/evals

# Run FTS test
node fts-recall.js

# Run evals
node runner.js --output ci-results.json

# Check exit code
if [ $? -ne 0 ]; then
  echo "AI tests failed"
  exit 1
fi
```

---

## Reports

### Generate HTML Report
```powershell
.\ai-test-runner.ps1 -All -Report
```

Output: `integrations/openclaw/evals/test-report.html`

### Export Gap Report
```bash
node gap-tracker.js --export > gaps-$(date +%Y%m%d).md
```

### Save Eval Results
```bash
node runner.js --output eval-$(date +%Y%m%d).json
```

---

## Next Steps

1. ✅ Run FTS recall test
2. ✅ Run evaluation runner
3. ✅ Review failed cases (none in the current hybrid run)
4. ✅ Keep current prompts for this baseline
5. ⬜ Expand knowledge base
6. ✅ Re-run tests
7. ⬜ Complete pilot review before deployment

---

## Contact

For AI engineering questions:
- Prompt tuning → Edit files in `integrations/openclaw/prompts/`
- Knowledge base → Edit files in `database/seeds/`
- Eval datasets → Edit files in `integrations/openclaw/evals/`
