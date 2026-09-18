# AI Tuning Progress Tracker

> Track tuning experiments and metrics per ask-track-ai-plan.md Section 5.

## Metrics Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Citizen access others' ticket | 0 | - | Test ready |
| AI status mutation | 0 | - | Test ready |
| TRACK status vs DB | 100% | - | Test ready |
| Ticket without persistence | 0 | - | ✅ Verified |
| Ticket without photo | 0 | - | ✅ Verified |
| ASK without valid source | 0 | - | Test ready |
| Simulated alias recall@5 | ≥90% | **100%** | ✅ Pass |
| Routing macro-F1 | ≥0.90 | - | Dataset ready |
| Hybrid scenario success | ≥90% | **153/153** | ✅ Pass |
| Context leak | 0 | - | Test ready |
| Latency p95 | ≤10s | - | Runtime needed |

## Tuning Log

### Experiment 0: Baseline
- **Date:** 2026-09-17
- **Variable:** None (baseline)
- **Description:** Initial setup with 6 knowledge chunks, 7 eval cases
- **Result:** Foundation established

### Experiment 1: Dataset Expansion
- **Date:** 2026-09-17
- **Variable:** Evaluation datasets
- **Description:** Expanded datasets to 156 cases
- **Result:** ASK (40), TRACK (30), REPORT (30), Error/Attack (55), E2E (1)

### Experiment 2: Knowledge Expansion
- **Date:** 2026-09-17
- **Variable:** Knowledge chunks + aliases
- **Description:** 26 chunks with comprehensive aliases
- **Result:** FTS recall improved

### Experiment 3: Backend Enhancement
- **Date:** 2026-09-17
- **Variable:** Admin endpoints, auth, smoke tests
- **Description:** Added admin routes, Bearer auth, test scripts
- **Result:** Full test suite ready

### Experiment 4: Retrieval and integration repair
- **Date:** 2026-09-18
- **Variable:** aliases, minimum rank, and live backend evaluation
- **Description:** Added local-language aliases, rejected weak unscoped matches,
  seeded 26 explicitly simulated chunks, and ran ASK/TRACK through FastAPI.
- **Result:** Simulated alias recall 35/35; hybrid suite 153/153; live ASK and
  TRACK endpoints operational; one real OpenClaw/Gemini structured-response
  smoke test passed with `google/gemini-3.1-flash-lite`.
- **Limitation:** REPORT, security, and E2E fixtures in `runner.js` remain
  deterministic checks. They are not model-quality scores.

## Knowledge Base Stats

| Document | Chunks | service_keys | Status |
|----------|--------|--------------|--------|
| demo-administrasi | 8 | office_hours, ktp_*, kontak_desa | ✅ Active |
| demo-lingkungan | 6 | road, drainage, waste, streetlight | ✅ Active |
| demo-glossary | 5 | istilah_wilayah, istilah_drainase | ✅ Active |
| demo-status | 2 | track, status_info | ✅ Active |
| demo-faq | 5 | faq_waktu, faq_anonim, dll | ✅ Active |
| **Total** | **26** | **20+ service_keys** | ✅ |

## Dataset Coverage

| Dataset | File | Cases | Families |
|---------|------|-------|----------|
| report | report-p0.json | 29 | REPORT, security, multi_turn |
| ask | ask-p0.json | 42 | 13 ASK families |
| track | track-p0.json | 29 | TRACK, TRACK_security, TRACK_multi_turn |
| error/attack | error-attack-p0.json | 52 | 21 behavior families |
| e2e | e2e-flow.json | 1 | full flow |
| **Total** | - | **153** | **36 families** |

Target: 120 cases ✅ EXCEEDED (153)

## API Endpoints

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/health` | GET | None | ✅ |
| `/api/v1/ask` | POST | OpenClaw | ✅ |
| `/api/v1/track` | POST | OpenClaw | ✅ |
| `/api/v1/reports` | POST | OpenClaw | ✅ |
| `/api/v1/admin/reports` | GET | Bearer | ✅ |
| `/api/v1/admin/reports/{id}` | GET | Bearer | ✅ |
| `/api/v1/admin/reports/{id}/status` | PATCH | Bearer | ✅ |

## Test Suite

| Test | Command | Status |
|------|---------|--------|
| Plugin tests | `cd plugins/laporpak-tools && npm test` | ✅ Ready |
| Unit tests | `cd services/api && python -m pytest tests/` | ✅ Ready |
| Smoke tests | `cd services/api && python tests/smoke_test.py` | ✅ Ready |
| FTS recall | `cd evals && node fts-recall.js` | ✅ Ready |
| Eval runner | `cd evals && node runner.js` | ✅ Ready |
| Gap tracker | `cd evals && node gap-tracker.js --analyze` | ✅ Ready |
| Test suite | `cd evals && node test-suite.js` | ✅ NEW |
| AI test runner | `.\ai-test-runner.ps1 -All` | ✅ NEW |
| Full suite | `.\run-tests.ps1` | ✅ Ready |

## Test Suite Tools

| Tool | File | Purpose | Status |
|------|------|---------|--------|
| FTS Recall | `fts-recall.js` | Knowledge retrieval quality | ✅ |
| Eval Runner | `runner.js` | Dataset evaluation | ✅ v2.0 |
| Gap Tracker | `gap-tracker.js` | Unanswered question tracking | ✅ v2.0 |
| Test Suite | `test-suite.js` | All AI tests in sequence | ✅ NEW |
| Windows Runner | `ai-test-runner.ps1` | PowerShell test runner | ✅ NEW |
| Test Docs | `evals/README.md` | Testing guide | ✅ NEW |

## Tools

| Tool | File | Purpose |
|------|------|---------|
| Test Runner | `run-tests.ps1` | Run all tests |
| Smoke Test | `tests/smoke_test.py` | API endpoint tests |
| FTS Recall | `evals/fts-recall.js` | Retrieval quality |
| Gap Tracker | `evals/gap-tracker.js` | Track unanswered questions |
| Eval Runner | `evals/runner.js` | Run eval datasets |

## Database Migrations

| File | Isi | Status |
|------|-----|--------|
| `0005_backend_production_readiness.sql` | Admin scope, REQUEST, pgvector, knowledge | ✅ Ready |
| `0007_enhanced_features.sql` | Resolution confirmation and advisory fields | ✅ Ready |
| `0008_village_knowledge.sql` | Village knowledge authoring metadata | ✅ Ready |
| `0013_report_attachment_storage.sql` | Private REPORT photo bucket | ✅ Ready |

## Known Issues

- [x] `attachment_waived` removed from API contract
- [x] Admin endpoints route conflict resolved (now `/api/v1/admin/reports`)
- [x] httpx moved to module level import
- [ ] WhatsApp integration needs runtime verification
- [ ] Supabase credentials needed for admin auth
- [ ] Database migrations need to be applied

## Next Steps (Priority Order)

### 1. Immediate (Testing)
```powershell
# Start the system
.\start-laporpak.ps1

# Run smoke tests
cd services\api
python tests/smoke_test.py
```

### 2. Runtime Verification
```bash
# Run FTS recall test
cd integrations/openclaw/evals
node fts-recall.js

# Run eval runner
node runner.js --verbose
```

### 3. Admin Endpoint Testing
1. Apply all migrations in filename order
2. Apply the canonical seeds in filename order
3. Create Supabase auth user
4. Create admin_account record
5. Test with Bearer token

### 4. WhatsApp E2E Test
1. Pair test WhatsApp number
2. Send test message
3. Verify flow: ASK → REPORT → CONFIRM → TICKET → TRACK

### 5. Pilot Preparation
1. Verify all FTS recall ≥90%
2. Test security scenarios
3. Train operator on dashboard
4. Deploy to pilot WhatsApp

## Tuning Principles

1. **Tune data, retrieval, and behavior** — not model weights
2. **Change one variable at a time** — prompt, then alias, then model
3. **Log version, latency, and result** — use experiment template
4. **Keep baseline** — until new approach proves better
5. **Target recall@5 ≥90%** — before adding pgvector

## AI Enhancement Features

### Implemented Enhancements

| Feature | File | Purpose |
|---------|------|---------|
| Context Recovery | `prompts/context-recovery.md` | Handle "yang tadi", "itu", "kemarin" |
| Smart Clarification | `prompts/clarification.md` | Ask questions in optimal order |
| Intent Chain | `prompts/intent-chain.md` | Detect ASK↔REPORT↔TRACK transitions |
| Confidence Calibration | `prompts/confidence.md` | Know when AI is uncertain |
| Cross-lingual Aliases | `seeds/0006_crosslingual_aliases.sql` | Indonesian + regional language |
| Date/Time Extraction | `prompts/datetime-extraction.md` | Parse "kemarin", "besok", etc. |

### High-Impact AI Features (NEW)

| Feature | Status | Impact |
|---------|--------|--------|
| **SLA Tracking** | ✅ Implemented | Accountability - warga tahu deadline |
| **Emergency Detection** | ✅ Implemented | Prioritas keyword emergency |
| **Similar Reports** | ✅ Implemented | Kurangi duplicate |
| **Resolution Confirmation** | ✅ Implemented | Quality assurance dari warga |

### SLA Configuration

| Urgency | SLA | Label |
|---------|-----|-------|
| critical | 24 jam | 1x24 jam |
| high | 72 jam | 3x24 jam |
| medium | 168 jam | 1 minggu |
| low | 720 jam | 1 bulan |

### Prompt Templates

| Template | Purpose | Status |
|----------|---------|--------|
| report-analysis.md | REPORT extraction | ✅ |
| ask-extraction.md | ASK classification | ✅ |
| track-context.md | TRACK extraction | ✅ |
| context-recovery.md | Multi-turn recovery | ✅ NEW |
| clarification.md | Smart questioning | ✅ NEW |
| intent-chain.md | Intent transitions | ✅ NEW |
| confidence.md | Uncertainty handling | ✅ NEW |
| datetime-extraction.md | Temporal parsing | ✅ NEW |

### Cross-lingual Coverage

| Language | Coverage |
|----------|----------|
| Indonesian (Bahasa) | ✅ Full |
| Javanese | ✅ Common terms |
| Sundanese | ✅ Basic |
| English | ✅ Mixed phrases |
| Chinese (loanwords) | ✅ Informal |
