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

2. Enable `llm-task` and restrict the extraction agent to that tool while the
   create-report tool is not yet integrated:

   ```json5
   {
     plugins: { entries: { "llm-task": { enabled: true } } },
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

No model ID is pinned yet. Select a model returned by
`openclaw models list --provider google`, record it with eval results, and pin
it only after the P0 dataset passes.

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
