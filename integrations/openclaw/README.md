# OpenClaw REPORT integration

This directory contains the version-controlled, secret-free inputs for P0
REPORT extraction. OpenClaw owns Gemini invocation and conversation state;
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

2. Enable `llm-task`, pin the evaluated model, and restrict the extraction
   agent to that tool while the create-report tool is not yet integrated.
   Merge these entries with any existing plugin or tool allowlist:

   ```json5
   {
     plugins: {
       entries: {
         "llm-task": {
           enabled: true,
           config: {
             defaultProvider: "google",
             defaultModel: "gemini-3.1-flash-lite",
             allowedModels: ["google/gemini-3.1-flash-lite"],
             maxTokens: 1600,
             timeoutMs: 60000
           }
         }
       }
     },
     tools: { allow: ["llm-task"] }
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

The OpenClaw host also needs `LAPORPAK_API_URL` and `LAPORPAK_API_KEY` from
its local environment when invoking the backend. Send the latter as
`X-OpenClaw-API-Key` and send the stable report draft UUID as
`Idempotency-Key` to `POST /api/v1/reports`.

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

This foundation supports isolated structured extraction only. Conversation
state, citizen confirmation, `create_report`, retry/idempotency, and WhatsApp
wiring are later phases and must follow the canonical repository workflow.
