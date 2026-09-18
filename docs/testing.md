# Test Runner

Run all tests for LaporPak with a single command.

## Prerequisites

- Python 3.14+
- Node.js (for OpenClaw tests)
- pip install httpx pytest (for Python tests)

## Quick Start

```powershell
# Run all tests
.\run-tests.ps1

# Or run individual components
cd services\api
python -m pytest tests/ -v
python tests/smoke_test.py
```

## Test Components

### 1. OpenClaw Plugin Tests
Location: `integrations/openclaw/plugins/laporpak-tools/`
```bash
npm test
```

### 2. FastAPI Unit Tests
Location: `services/api/tests/`
```bash
cd services/api
python -m pytest tests/ -v
```

### 3. Smoke Tests
Tests live API endpoints (requires running server)
```bash
cd services/api
python tests/smoke_test.py
```

### 4. FTS Recall Tests
Tests knowledge base retrieval quality
```bash
cd integrations/openclaw/evals
node fts-recall.js
```

### 5. Evaluation Runner
Runs full evaluation datasets
```bash
cd integrations/openclaw/evals
node runner.js --verbose
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LAPORPAK_API_URL` | `http://localhost:8000` | API base URL |
| `LAPORPAK_API_KEY` | `test-secret` | OpenClaw API key |

## Expected Output

```
========================================
LaporPak Test Runner
========================================

Checking Node.js...
  Node.js: v20.x.x

========================================
Running OpenClaw Plugin Tests
========================================
  ✓ validates URL normalization
  ✓ validates phone number
  ✓ validates MIME type
  ✓ validates attachment URL
  ✓ validates attachment structure
  ✓ validates report creation parameters

========================================
Running FastAPI Tests
========================================
  ✓ test_ask_requires_internal_auth
  ✓ test_ask_returns_grounded_blocks
  ✓ test_track_filters_by_normalized_owner
  ...

========================================
Running Smoke Tests
========================================
  ✓ GET /health
  ✓ POST /api/v1/ask
  ✓ POST /api/v1/track
  ...

========================================
Running FTS Recall Test
========================================
  Testing 35 query patterns...
  Total: 35
  Passed: 33 (94.3%)
  ✅ PASSED: 94.3% meets target (≥90%)

========================================
Test Run Complete
========================================
```

## Troubleshooting

### "httpx not installed"
```powershell
pip install httpx pytest
```

### "Node.js not found"
Install Node.js from https://nodejs.org/

### "Connection refused" on smoke test
Make sure FastAPI is running:
```powershell
cd services\api
uv run uvicorn app.main:app --port 8000
```
