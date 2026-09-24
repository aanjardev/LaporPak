# OpenClaw integration

This directory contains the version-controlled, secret-free inputs for REPORT,
ASK, TRACK, and REQUEST support. OpenClaw owns Gemini invocation and conversation state;
FastAPI does not call Gemini.

## Baseline setup

1. Configure Google AI Studio authentication outside this repository:

   ```powershell
   openclaw onboard --auth-choice gemini-api-key
   openclaw models list --provider google
   ```

   `GEMINI_API_KEY` belongs in the OpenClaw host environment (for example,
   `%USERPROFILE%\.openclaw\.env` on Windows). Use `.env.example` in this
   directory only as a key-name template; never add a real value to Git.

2. Enable `llm-task` and `laporpak-tools`, pin the evaluated model, and limit
   the agent to the approved LaporPak tools. Merge these entries
   with any existing plugin or tool allowlist:

   ```json5
   {
     plugins: {
       entries: {
         "llm-task": {
           enabled: true,
           config: {
             defaultProvider: "google",
             defaultModel: "gemini-3.1-flash-lite",
             maxTokens: 1600,
             timeoutMs: 60000
           },
           llm: {
             allowModelOverride: true,
             allowAuthProfileOverride: true,
             allowedCompletionModels: ["google/gemini-3.1-flash-lite"]
           }
          },
          "laporpak-tools": {
            enabled: true
          }
        },
        allow: ["google", "llm-task", "laporpak-tools"]
      },
      tools: {
        allow: [
          "llm-task",
          "laporpak_create_report",
          "laporpak_ask",
          "laporpak_track_report",
          "laporpak_create_service_request",
          "laporpak_detect_emergency",
          "laporpak_check_similar",
          "laporpak_confirm_resolution"
        ]
      }
   }
   ```

3. Invoke `llm-task` with:

   - `prompts/report-analysis.md` as `prompt`;
   - citizen text and current draft facts as `input`;
   - `schemas/ai-analysis.schema.json` as `schema`.

Use `details.json` as the untrusted result and validate it again with
`app.schemas.ai_analysis.AIAnalysis` before it reaches backend business logic.
Do not put `GEMINI_API_KEY`, channel credentials, or backend credentials in
this directory, prompts, logs, or model input.

The OpenClaw host also needs `LAPORPAK_API_URL` and `LAPORPAK_API_KEY` from its
local environment. For two villages, set `LAPORPAK_REQUIRE_RUNTIME_ACCOUNT=true`
and use the trusted OpenClaw channel account context; do not set one global
`LAPORPAK_CHANNEL_ACCOUNT_ID` for both. A single-account host may use that
environment value as a fallback. Send the channel ID as `X-Channel-Account-ID`,
the API key as `X-OpenClaw-API-Key`, and a stable
draft UUID as `Idempotency-Key` for create operations.

Referral tools are a separate M2 operator capability. They remain absent from
the WhatsApp village-agent allowlist above. A dedicated internal operator agent
may opt in with `LAPORPAK_REFERRAL_TOOLS_ENABLED=true`, a short-lived
`LAPORPAK_OPERATOR_ACCESS_TOKEN`, and only these tool names:

```text
laporpak_get_case_context
laporpak_get_routing_candidates
laporpak_prepare_referral
laporpak_request_referral_dispatch
laporpak_get_referral_progress
```

FastAPI validates the bearer token and village membership. The plugin exposes
no approval tool, refuses these calls from WhatsApp contexts, never accepts a
destination URL or village scope, and always omits citizen identity from a
model-prepared package.

The version-controlled plugin is in `plugins/laporpak-tools`. Install it on
the OpenClaw host, enable it in `plugins.entries`, and allow only the tools
listed above. Core tools require an authenticated WhatsApp context and take
sender/channel identity from trusted runtime metadata. Call create operations
only after the citizen confirms a complete draft. ASK and TRACK remain
read-only.

Knowledge embeddings are generated only on this host. Configure
`GEMINI_API_KEY` and optionally `GEMINI_EMBEDDING_MODEL` (default
`gemini-embedding-001`), then drain all approved/development-demo jobs with:

```powershell
cd integrations/openclaw/plugins/laporpak-tools
npm run embeddings:drain
```

The worker requests 768-dimensional `RETRIEVAL_DOCUMENT` vectors and reports a
failed job to FastAPI before exiting. ASK creates a matching
`RETRIEVAL_QUERY` vector. If ASK returns `trust_level=demo`, the tool includes a
simulation notice which must remain visible in the citizen response.

See `../../docs/whatsapp-setup.md` for Windows setup, QR pairing, access
policy, verification, and troubleshooting.

The current baseline is `google/gemini-3.1-flash-lite`. On 2026-09-17 it
passed all 7 cases in `evals/report-p0.json` through OpenClaw 2026.7.1 and was
then validated again with `AIAnalysis`. Re-run the dataset before changing the
model or prompt.

## Evaluation

`evals/report-p0.json` contains the seven minimum workflow scenarios. Enum,
schema, forbidden operational claims, and missing-field expectations are hard
assertions. `facts` are semantic assertions: the output may rephrase them but
must preserve their meaning. Do not compare summary wording or confidence
scores exactly, and do not add real citizen data to this dataset.

## Current boundary

Structured REPORT extraction, idempotent REPORT/REQUEST creation, grounded ASK,
private TRACK, supporting REPORT tools, and opt-in operator referral tools are implemented. Conversation state,
citizen confirmation behavior, and WhatsApp channel setup remain OpenClaw host
responsibilities. Administrative decisions remain human-only backend actions.

For the repeatable local integration sequence, see
[`../../docs/demo-runbook.md`](../../docs/demo-runbook.md).
