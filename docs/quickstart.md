# LaporPak Quick Start Guide

## Prerequisites

- Python 3.14+
- Node.js 24.15+
- Supabase project
- WhatsApp Business account (optional for testing)

## 1. Environment Setup

Create `services/api/.env`:

```env
# Database
DATABASE_URL=

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SECRET_KEY=your-secret-key

# OpenClaw (for internal API calls)
OPENCLAW_API_KEY=your-openclaw-key

# App
APP_ENV=development
FRONTEND_URL=http://localhost:3000
```

## 2. Apply Database Migrations

Apply every file in `database/migrations/` in filename order. Never replace or
skip an already-applied migration.

## 3. Seed Demo Data

```bash
cd database/seeds
psql $DATABASE_URL -f 0001_report_categories.sql
psql $DATABASE_URL -f 0002_demo_administrative_units.sql
psql $DATABASE_URL -f 0003_production_access.sql
```

## 4. Start Backend

```powershell
cd services/api
uv run uvicorn app.main:app --reload --port 8000
```

Or, from the repository root, use the helper script:
```powershell
.\start-laporpak.ps1
```

## 5. Run Tests

```powershell
# Full test suite
.\run-tests.ps1

# Just smoke tests
cd services/api
python tests/smoke_test.py

# FTS recall test
cd integrations/openclaw/evals
node fts-recall.js
```

## 6. Test Endpoints

```bash
# Health check
curl http://localhost:8000/health

# ASK (with OpenClaw key)
curl -X POST http://localhost:8000/api/v1/ask \
  -H "X-OpenClaw-API-Key: your-openclaw-key" \
  -H "X-Channel-Account-ID: your-whatsapp-account-id" \
  -H "Content-Type: application/json" \
  -d '{"question": "Kapan kantor buka?"}'

# TRACK
curl -X POST http://localhost:8000/api/v1/track \
  -H "X-OpenClaw-API-Key: your-openclaw-key" \
  -H "X-Channel-Account-ID: your-whatsapp-account-id" \
  -H "Content-Type: application/json" \
  -d '{"sender_phone_number": "081234567890"}'
```

## 7. Verify FTS Retrieval

```bash
cd integrations/openclaw/evals
node fts-recall.js
```

Expected output:
```
🔍 FTS Recall Test

Testing 35 query patterns...

📊 Summary

Total: 35
Passed: 33 (94.3%)
❌ BELOW TARGET: 94.3% (need 0.0% more)

🎯 Target: recall@5 ≥90%

✅ PASSED: 94.3% meets target
```

## 8. Create Admin Account

1. Create user in Supabase Auth
2. Run SQL:
```sql
INSERT INTO public.admin_accounts (auth_user_id, role, is_active, display_name)
VALUES ('your-auth-uuid', 'system_admin', true, 'Test Admin');
```

3. Get Bearer token from Supabase
4. Test admin endpoint:
```bash
curl http://localhost:8000/api/v1/admin/reports \
  -H "Authorization: Bearer your-token"
```

## Troubleshooting

### "Connection refused"
- Make sure FastAPI is running on port 8000

### "401 Unauthorized"
- Check `OPENCLAW_API_KEY` matches in .env and OpenClaw config

### "503 Supabase not configured"
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set

### "404 REPORT_NOT_FOUND"
- This is expected if no reports exist
- Create one via WhatsApp or check demo data

## Next Steps

1. ✅ Run all tests
2. ✅ Verify FTS recall ≥90%
3. ⬜ Setup WhatsApp integration
4. ⬜ Create real admin accounts
5. ⬜ Deploy to pilot
