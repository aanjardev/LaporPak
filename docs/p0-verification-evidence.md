# P0 REPORT Verification Evidence

> Date: 2026-09-17  
> Environment: Supabase development + FastAPI local process  
> Branch: `feat/db-foundation`

## End-to-end backend demonstration

The demonstration used the versioned OpenClaw request contract and a temporary
in-memory API key. No temporary key was written to a file or committed.

| Check | Result |
|---|---|
| Create a complete WhatsApp report | `201 Created` |
| Retry the same draft and payload | `200 OK`, same ticket |
| Read report detail as dashboard admin | `200 OK` |
| Verify `pending_verification -> verified` | `200 OK` |
| Persist initial and verification history | 2 history rows |

Persisted demonstration record:

```text
ticket_number: LP-2026-0002
status: verified
```

The first real detail request exposed an internal-column serialization bug.
The service boundary was corrected to select only response-schema history
fields, and the repository-shaped regression case is now covered by the test
suite.

## Negative-path verification

| Scenario | Boundary | Expected and observed result |
|---|---|---|
| Missing location | API request | `422 VALIDATION_ERROR` |
| Same idempotency key, different payload | API + Supabase | `409 DUPLICATE_OPERATION` |
| Detail access without admin credential | API request | `401 UNAUTHORIZED` |
| Disallowed `verified -> resolved` transition | API + Supabase | `409 INVALID_STATUS_TRANSITION` |
| Rejected transition leaves official state unchanged | Supabase verification | status remains `verified`; history remains 2 rows |
| `UNKNOWN` structured result | Pydantic AI boundary | accepted as `UNKNOWN`; no report tool invocation |
| Persistence/history failure | Service transaction tests | rollback and controlled `DATABASE_UNAVAILABLE` mapping |
| Invalid or unavailable AI output | OpenClaw prompt/schema contract | no operational write; clarification/retry/manual fallback |

## Automated checks

```text
Backend pytest:        92 passed
Backend Ruff:          passed
OpenClaw plugin tests: 2 passed
Dashboard ESLint:      passed
Dashboard build:       passed
git diff --check:      passed
```

The standalone dashboard test file cannot run on the local Node.js `20.19.1`
because it imports TypeScript directly. The application itself passes ESLint,
TypeScript compilation, and the complete Next.js production build. Re-run the
standalone test with the repository's intended current Node.js LTS runtime when
the frontend integration resumes.

The AI evaluation dataset covers complete REPORT, missing location, ambiguous
description, unrelated input/UNKNOWN, ambiguous urgency, prompt injection, and
multiple incidents. Live Gemini and WhatsApp execution remains pending until
the AI engineer provides the OpenClaw host and channel credentials.

## Remaining integration gate

When credentials are available, run one channel-level flow:

```text
WhatsApp -> OpenClaw -> Gemini -> laporpak_create_report
         -> FastAPI -> Supabase -> dashboard
```

Confirm that OpenClaw reuses one stable report draft UUID for repeated citizen
confirmation and sends only the allowlisted report-creation tool.

## Full dashboard integration smoke test

Verified manually on 2026-09-17 after enabling `REPORTS_DATA_SOURCE=api`:

```text
WhatsApp/OpenClaw -> FastAPI -> Supabase -> admin dashboard
                  -> human verification -> persisted status history
```

Observed results:

- WhatsApp-created ticket `LP-2026-0003` appeared in the authenticated report list.
- Its database-backed category, location, urgency, status, and creation time rendered correctly.
- The invited Supabase Auth admin could open the detail and submit a verification reason.
- The verified status and history remained correct after page reload and list navigation.
- Logging out prevented direct access to `/reports` and redirected to login.

This completes the P0 REPORT happy path through the real citizen channel,
database, authenticated dashboard, and human verification boundary.
