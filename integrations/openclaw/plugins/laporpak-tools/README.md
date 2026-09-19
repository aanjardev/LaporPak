# LaporPak Tools

OpenClaw plugin for LaporPak citizen service gateway. Provides tools for ASK,
REPORT, TRACK, and enhanced AI-powered features through the FastAPI boundary.

## Core Tools

### `laporpak_create_report`

Creates a confirmed REPORT. Accepts only verified facts, gets citizen identity
and inbound photos from authenticated WhatsApp runtime metadata, and calls
FastAPI with a stable idempotency key derived by the plugin.

### `laporpak_ask`

Queries approved village knowledge. Returns answer blocks and sources from
the knowledge base. Use answer blocks as factual basis for responses;
do not re-generate facts from model.

### `laporpak_track_report`

Reads the authenticated sender's own REPORT status. Ownership and village scope
are enforced server-side. FastAPI already recognizes `REQ-*`, but this tool's
current input schema accepts only `LP-*`; expand it only after REQUEST is
approved for citizen use.

## Enhanced Tools

### `laporpak_detect_emergency`

Detects emergency keywords (kebakaran, banjir, dll) in citizen messages.
Returns flag for immediate review.

### `laporpak_check_similar`

Checks for existing similar reports before creating new one. Reduces
duplicates and informs citizens about existing reports in the area.

### `laporpak_confirm_resolution`

Records citizen's confirmation when a report is marked resolved.
If rejected, records a human-review request without changing official status.

## Runtime Configuration

```env
LAPORPAK_API_URL=http://localhost:8000
LAPORPAK_API_KEY=<internal-key>
LAPORPAK_CHANNEL_ACCOUNT_ID=<authenticated-whatsapp-account-id>
```

The plugin does not read Supabase or Gemini credentials and never accepts
an API URL, API key, or citizen phone number from model-generated tool input.

## Tuning Guide

### Alias Expansion

Add aliases to knowledge chunks in `metadata->>'aliases'` to improve FTS recall:

```sql
-- Example alias configuration
'{"service_key":"road_report","aliases":["jalan rusak","lubang","aspal"]}'
```

### Knowledge Chunk Best Practices

1. **Chunk per service** — One discrete answer block per chunk
2. **Include common phrases** — Residents use varied terminology
3. **Limit to 1-2 sentences** — Shorter chunks improve retrieval precision
4. **Use Indonesian** — Match expected citizen phrasing

### Retrieval Metrics

Track these metrics per ask-track-ai-plan.md Section 5:

- **recall@5** — Target ≥90% for questions with known sources
- **latency p95** — Target ≤10s in pilot environment

### Prompt Tuning

Modify `prompts/report-analysis.md` for extraction behavior:
- Category classification rules
- Clarification threshold
- Confidence calibration

### Evaluation

Run evaluation datasets from `integrations/openclaw/evals/`:

```bash
# Run report evaluation
cat evals/report-p0.json | jq '.[]'

# Check eval index
cat evals/index.json
```

Target datasets: 120 conversations (40 ASK, 30 TRACK, 30 REPORT, 20 error/attack).

## Testing

Run dependency-free tests with:

```powershell
npm test
```

## Schema Validation

Tool parameters are validated by OpenClaw before FastAPI validates the final
request with Pydantic.
