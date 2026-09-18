# AI Engineering Checklist - LaporPak

> Comprehensive checklist for AI engineering tasks.

---

## 🎯 QUICK REFERENCE

### Daily Commands
```powershell
# Run all AI tests
.\ai-test-runner.ps1 -All

# Quick FTS check
cd integrations/openclaw/evals
node fts-recall.js

# Check gaps
node gap-tracker.js --stats
```

---

## ✅ PRE-FLIGHT CHECKLIST

### Environment Setup
| Item | Status | Command |
|------|--------|---------|
| Node.js installed | ⬜ | `node --version` |
| Python 3.14+ installed | ⬜ | `python --version` |
| uv installed | ⬜ | `uv --version` |
| OpenClaw CLI | ⬜ | `openclaw --version` |
| Git configured | ⬜ | `git config --global user.name` |

### Environment Variables
| Variable | Location | Status |
|----------|----------|--------|
| `GEMINI_API_KEY` | `.openclaw/.env` | ⬜ |
| `LAPORPAK_API_URL` | `.openclaw/.env` | ⬜ |
| `LAPORPAK_API_KEY` | `.openclaw/.env` | ⬜ |
| `DATABASE_URL` | `services/api/.env` | ⬜ |
| `SUPABASE_URL` | `services/api/.env` | ⬜ |
| `SUPABASE_SECRET_KEY` | `services/api/.env` | ⬜ |

### Service Status
| Service | Port | Status |
|---------|------|--------|
| FastAPI | 8000 | ⬜ |
| OpenClaw Gateway | 18789 | ⬜ |
| Supabase | Cloud | ⬜ |

---

## 📋 AI COMPONENT CHECKLIST

### 1. Prompt Engineering

| Prompt | File | Status | Notes |
|--------|------|--------|-------|
| REPORT extraction | `prompts/report-analysis.md` | ✅ | |
| ASK classification | `prompts/ask-extraction.md` | ✅ | |
| TRACK extraction | `prompts/track-context.md` | ✅ | |
| Intent chain | `prompts/intent-chain.md` | ✅ | |
| Smart clarification | `prompts/clarification.md` | ✅ | |
| Confidence calibration | `prompts/confidence.md` | ✅ | |
| Context recovery | `prompts/context-recovery.md` | ✅ | |
| DateTime parsing | `prompts/datetime-extraction.md` | ✅ | |

### 2. AI Schema & Validation

| Schema | File | Status | Notes |
|--------|------|--------|-------|
| AI Analysis JSON | `schemas/ai-analysis.schema.json` | ✅ | |
| AIAnalysis Pydantic | `app/schemas/ai_analysis.py` | ✅ | |
| Intent enum | `app/schemas/enums.py` | ✅ | |

### 3. OpenClaw Tools

| Tool | File | Status | Notes |
|--------|------|--------|-------|
| `laporpak_create_report` | `plugins/laporpak-tools/index.js` | ✅ | |
| `laporpak_ask` | `plugins/laporpak-tools/index.js` | ✅ | |
| `laporpak_track_report` | `plugins/laporpak-tools/index.js` | ✅ | |
| `laporpak_detect_emergency` | `plugins/laporpak-tools/index.js` | ✅ | |
| `laporpak_check_similar` | `plugins/laporpak-tools/index.js` | ✅ | |
| `laporpak_confirm_resolution` | `plugins/laporpak-tools/index.js` | ✅ | |

### 4. Agent Configuration

| Item | Status | Notes |
|------|--------|-------|
| Workspace policy | ✅ | `workspace/AGENTS.md` |
| Plugin manifest | ✅ | `openclaw.plugin.json` |
| Tool allowlist | ✅ | Configured |
| Model pinning | ✅ | `gemini-3.1-flash-lite` |

---

## 🧪 TESTING CHECKLIST

### Unit Tests
| Test | Command | Target | Status |
|------|---------|--------|--------|
| Plugin tests | `npm test` | 100% | ⬜ |
| Backend unit | `pytest tests/` | 80% | ⬜ |

### Integration Tests
| Test | Command | Target | Status |
|------|---------|--------|--------|
| FTS recall | `node fts-recall.js` | ≥90% | ✅ |
| Eval runner | `node runner.js` | ≥90% | ✅ |
| Gap tracker | `node gap-tracker.js --analyze` | - | ✅ |
| Test suite | `node test-suite.js` | All pass | ✅ |

### E2E Tests
| Scenario | Status | Notes |
|----------|--------|-------|
| REPORT flow | ⬜ | Manual test |
| ASK flow | ⬜ | Manual test |
| TRACK flow | ⬜ | Manual test |
| Multi-turn | ⬜ | Manual test |

### Security Tests
| Scenario | Status | Notes |
|----------|--------|-------|
| Prompt injection | ⬜ | Via `error-attack-p0.json` |
| Data enumeration | ⬜ | Via `error-attack-p0.json` |
| Privilege escalation | ⬜ | Via `error-attack-p0.json` |

---

## 📊 METRICS TARGETS

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| FTS Recall@5 | ≥90% | 94% | ✅ Pass |
| Routing Macro-F1 | ≥0.90 | - | ⬜ |
| Scenario Family | ≥90% | - | ⬜ |
| Context Leak | 0 | - | ⬜ |
| AI Status Mutation | 0 | - | ⬜ |
| Ticket Without Photo | 0 | 0 | ✅ |
| Latency p95 | ≤10s | - | ⬜ |

---

## 🔄 DEPLOYMENT CHECKLIST

### Pre-Deployment
| Item | Status | Notes |
|------|--------|-------|
| All tests pass | ⬜ | |
| No secrets in code | ⬜ | |
| Documentation updated | ⬜ | |
| Changelog updated | ⬜ | |
| Version bumped | ⬜ | |

### Post-Deployment
| Item | Status | Notes |
|------|--------|-------|
| API health check | ⬜ | |
| FTS recall re-test | ⬜ | |
| E2E smoke test | ⬜ | |
| Monitoring enabled | ⬜ | |

---

## 🔧 MAINTENANCE TASKS

### Daily
- [ ] Run FTS recall test
- [ ] Check error logs
- [ ] Review gap tracker

### Weekly
- [ ] Run full test suite
- [ ] Analyze gap trends
- [ ] Review failed evals
- [ ] Update knowledge base

### Monthly
- [ ] Prompt version review
- [ ] Model performance analysis
- [ ] Knowledge base expansion
- [ ] Crosslingual coverage check

---

## 📚 DOCUMENTATION CHECKLIST

| Document | Location | Status |
|----------|----------|--------|
| Testing guide | `evals/README.md` | ✅ |
| Prompt library | `prompts/README.md` | ✅ |
| Tuning progress | `TUNING.md` | ✅ |
| WhatsApp setup | `docs/whatsapp-setup.md` | ✅ |
| Quick start | `docs/quickstart.md` | ✅ |

---

## 🚨 TROUBLESHOOTING GUIDE

### FTS Recall Low
1. Check knowledge base has content
2. Verify FTS aliases cover query
3. Run: `node gap-tracker.js --analyze`
4. Add missing aliases

### Eval Failures
1. Check prompt examples
2. Verify schema matches
3. Run with `--verbose`
4. Review failure patterns

### API Errors
1. Check FastAPI running: `curl localhost:8000/health`
2. Verify environment variables
3. Check Supabase connection
4. Review error logs

### WhatsApp Issues
1. Check channel status: `openclaw channels status --probe`
2. Re-scan QR if expired
3. Verify pairing approved
4. Check gateway logs

---

## 📞 SUPPORT RESOURCES

| Resource | Link/Command |
|----------|--------------|
| OpenClaw docs | `openclaw --help` |
| FastAPI docs | `localhost:8000/docs` |
| API contract | `docs/api-contract.md` |
| Workflows | `docs/workflows.md` |

---

## ✅ SIGN-OFF

Before each commit/PR:
- [ ] Tests pass
- [ ] No secrets committed
- [ ] Documentation updated
- [ ] Code linted

Before each deployment:
- [ ] All checklists complete
- [ ] Team review done
- [ ] Rollback plan ready
