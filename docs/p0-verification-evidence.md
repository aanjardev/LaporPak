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

## Frontend integration recheck — 2026-09-18

Code commit: `028784d` on `fix/frontend-report-integration` (based on
`main` `2bf03ed`). Environment: Windows, Node.js `v22.16.0`, Next.js local
development on port 3000, FastAPI local on port 8000, Supabase development,
and an invited test admin. Test data is synthetic; no credentials or tokens
are recorded here. `REPORTS_DATA_SOURCE=api` was set only in the ignored
dashboard `.env.local`.

| Check | Source | Observed result |
|---|---|---|
| `/health` | FastAPI nyata | `200` |
| List and detail without a bearer token | FastAPI nyata | Both returned `401 UNAUTHORIZED`; unauthenticated PATCH also returned `401` without a write |
| Sign in, reload, list, search/filter, and open detail | FastAPI nyata + manual dashboard check by Ferdi | Two database-backed reports appeared; mock label was absent; search/filter and detail worked after reload |
| Page 1 and page 2 (`page_size=20`, 21 synthetic rows) | API simulasi, direct HTTP | `200`; 20 items on page 1, one on page 2, `total=21` |
| List errors `401`, `403`, and service `503` | API simulasi, direct HTTP | Correct HTTP status and contract error code from the simulator; dashboard behavior still needs browser confirmation |
| PATCH errors `401`, `403`, `409`, and service `503`; unknown detail `404` | API simulasi, direct HTTP | Correct HTTP status and contract error code from the simulator; dashboard behavior still needs browser confirmation |
| Dashboard lint, TypeScript, report tests, auth tests, build | Local checks on code commit above | Passed; 7 report tests and 1 auth test |
| Secret and data-access scan | Git and dashboard source | `.env.local` and backend `.env` ignored; no tracked `.env`, frontend table access, or backend secret reference found |

The simulated API is an in-memory local server; it does not prove FastAPI
authorization, database persistence, village scope enforcement, or real
decision handling. At this point the real test database still contains only
two `verified` reports. Real verification and rejection of separate
`pending_verification` reports remain open by team decision. Real FastAPI
`403`, scoped `404`, and frontend failure-state browser checks also remain
open until each result is observed and recorded.

## REPORT integration recheck after backend readiness merge — 2026-09-18

Commit: `0ae9b9b` (`main`, tested on branch
`docs/p0-report-integration-recheck`). Environment: local Next.js on port
3000, local FastAPI on port 8000, development Supabase. Test payloads and
database records are synthetic. No token or secret is recorded here.

| Check | Source | Observed result |
|---|---|---|
| `/health` | Running FastAPI | `200`; the reloaded OpenAPI schema has 16 paths |
| GET list/detail and PATCH without a session | Running FastAPI | All returned `401 UNAUTHORIZED` |
| Migration and seed baseline | Development Supabase, read-only query | New admin, membership, channel, and service-request tables exist; three active admins and one active WhatsApp channel |
| Create REPORT with temporary in-memory OpenClaw key and seeded channel ID | In-process FastAPI `TestClient` + development Supabase | `503 DATABASE_UNAVAILABLE`; no ticket from that API request |
| Transaction diagnosis | Backend service + development Supabase | `resolve_channel_unit()` starts a session transaction; `create_idempotent_report()` then calls `session.begin()`, raising `InvalidRequestError` wrapped as `ReportPersistenceError` |
| Service persistence in isolation | Backend service + development Supabase, **bypasses API/channel** | Synthetic ticket `LP-2026-0004` was created as `pending_verification`; this does not prove the citizen flow |
| Backend pytest / Ruff | Local on commit above | 90 passed, 6 failed; Ruff passed. The six failing tests are in `tests/test_create_report_api.py` and exercise the now-required channel configuration/header and an invalid positional `APIError(...)` call |
| OpenClaw plugin tests | Local on commit above | 2 passed; plugin request code does not send required `X-Channel-Account-ID` header |

**Open blockers:** Anjar must repair the transaction boundary in REPORT POST,
the positional `APIError` calls, and update the affected tests. Farel must
provide the channel account ID from trusted WhatsApp metadata in the OpenClaw
tool request and test the deployed host. Local FastAPI has no configured
OpenClaw key, so the live server's authenticated POST and the actual WhatsApp
channel were not tested here. Human verification/rejection of two tickets,
reload persistence, scope enforcement, and live fallback remain open.
Ferdi chose to defer the manual dashboard decisions until the API and
OpenClaw blockers are corrected; no second synthetic ticket was created.

## Dashboard status action after backend transaction fix — 2026-09-18

Backend commit: `21d39a5` (`main`, merged PR #18). Environment: local Next.js,
local FastAPI, development Supabase. Ferdi reported that the dashboard
verification action succeeded after the backend update. A read-only database
check found synthetic ticket `LP-2026-0005` as `verified` with `verified_at`
populated, and `LP-2026-0004` as `rejected`. Each has two status-history
entries, including an admin action with a nonempty reason. This supports
persistence of both decision types. Ferdi subsequently reported that the
dashboard status progression worked. A later read-only check found
`LP-2026-0005` as `resolved`, with `resolved_at` populated and five history
entries, matching verification, start, forwarding, and resolution. The full
WhatsApp-to-ticket flow and remaining P0 integration scenarios are not yet
recorded as passed.

On the same backend commit, `uv run pytest -q` produced 95 passed and 4 failed.
The failures are in `tests/test_create_report_api.py`: its older POST fixture
does not supply a channel account ID or fallback village ID, so the route
returns `422` before the mocked create service is called. This test-fixture
issue is separate from the dashboard PATCH result and remains for Anjar to
resolve.
