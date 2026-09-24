# P0 REPORT Verification Evidence

## Release gate documentation — 2026-09-23

Baseline inspected: `85587a9` (local main matched origin/main). This round
prepares [the demo release gate](mvp-demo-release-checklist.md) and
[deployment runbook](deployment-runbook.md). It does not record new live E2E
passes. The team reports two test identities/villages and a persistent Windows
HTTPS host are available; connectivity, isolation and deployed behavior still
require the release matrix. ASK sources remain synthetic and REQUEST SOP is
not official. Historical evidence below retains its original environment/SHA.

For the next execution, record timestamp, FE/BE/plugin SHAs, Node/OpenClaw
versions, environment, anonymized village/admin aliases, synthetic ticket IDs,
expected/actual result, and evidence type (live API, WhatsApp, browser or
simulation). Leave unexecuted scenarios open; never substitute hybrid fixture
results for a full WhatsApp/Gemini run.

## Demo-readiness attachment recheck — 2026-09-19

Baseline `main`: `81417b0`. GitHub Actions run `35424935073` completed
successfully for that SHA.

Against the development Supabase project, an in-process FastAPI request created
synthetic ticket `LP-2026-0011` with one PNG. The object was read back through
the scoped report service with `image/png`; detail serialization exposed only
`id`, `file_name`, `mime_type`, `file_size`, and `created_at`. The dashboard now
uses a same-origin server proxy carrying the admin session to FastAPI and never
constructs a Supabase object URL.

Local checks on `feat/demo-readiness`: backend 119 passed and Ruff passed;
dashboard 15 passed, lint passed, and build passed; OpenClaw plugin 7 passed.
Actual browser authorization with two Supabase admin accounts and the
WhatsApp/Gemini flow remain manual integration gates documented in
`demo-runbook.md`.

> Date: 2026-09-17  
> Environment: Supabase development + FastAPI local process  
> Branch: `feat/db-foundation`

## REPORT closure recheck — 2026-09-19

Code commit: `40faf2fee5a989b30905608a18b474bdc9e89063` on `main`.
Environment: local Next.js on port 3000, local FastAPI on port 8000,
development Supabase, and an invited admin session. Test records are synthetic
or team-created test reports. No credentials, phone numbers, tokens, or photo
contents are recorded here.

| Check | Source | Observed result |
|---|---|---|
| Health and repository baseline | Running services + Git | FastAPI `/health` returned `200`; dashboard returned `200`; working tree was clean and synchronized with `origin/main` before documentation updates |
| First decision and complete status path | Real dashboard + FastAPI + Supabase | `LP-2026-0010` changed `pending_verification -> verified -> in_progress -> forwarded -> resolved`; all reasons, timestamps, and five history entries persisted after reload |
| Rejection path | Real dashboard + FastAPI + Supabase | `LP-2026-0011` changed `pending_verification -> rejected`; the reason and two history entries persisted after reload |
| Private report photos | Real Next.js proxy + FastAPI + Supabase Storage | Both reports loaded one private image through a same-origin route; images completed with nonzero natural width. Direct unauthenticated requests to the proxy and FastAPI attachment endpoint returned `401` |
| Missing detail | Real dashboard + FastAPI | A nonexistent UUID displayed “Laporan tidak ditemukan” |
| Unauthenticated report access | Real FastAPI | List, detail, attachment, and PATCH requests without a session returned `401`; the unauthorized PATCH did not change the completed report |
| Responsive and browser audit | Real dashboard | At 390 px and 1280 px, report detail had no horizontal overflow. Browser console contained no warnings or errors during the run |
| TRACK by ticket owner | Real FastAPI + development Supabase | **Failed:** owner and unrelated sender requests both returned `503 DATABASE_UNAVAILABLE` |
| TRACK diagnosis | Read-only repository call | PostgreSQL raised `AmbiguousParameter: could not determine data type of parameter $3` in the nullable ticket predicate of `CitizenRepository.track_reports()` |

Automated checks on the same commit:

```text
Backend pytest:               119 passed
Backend Ruff:                 passed
Focused REPORT/backend tests: 53 passed
OpenClaw plugin tests:          7 passed
REPORT AI evaluation:          19/19 passed
Dashboard auth tests:           1 passed
Dashboard REPORT tests:        10 passed
Dashboard knowledge tests:      4 passed
Dashboard REQUEST tests:        2 passed
Dashboard ESLint:              passed
Dashboard TypeScript:          passed
Dashboard production build:    passed
```

REPORT is not closed yet. Anjar must fix the TRACK query and the team must
repeat TRACK through the owner’s WhatsApp number. Before public deployment,
the shared environment must also prove an authenticated `403` and a scoped
cross-village `404`; current automated coverage does not replace those runtime
checks.

## Backend/knowledge/request recheck — 2026-09-19

Baseline `main`: `1030aa4`. Work continued on
`feat/request-ci-scope-hardening`; record its final merge SHA after review.

Observed against the development Supabase project:

- all critical REPORT, knowledge, admin-scope, channel, and REQUEST tables,
  columns, constraints, indexes, RLS flags, and functions are present;
- `vector`, `postgis`, and `pgcrypto` are active;
- `knowledge-files` and `report-attachments` are private; attachment storage is
  limited to 5 MB JPEG/PNG/WebP after applying migration `0013`;
- five clearly labelled `DATA UJI` documents were imported for Desa Sukamaju,
  one chunk each, and an idempotent rerun skipped all five;
- real FastAPI `POST /api/v1/ask` returned `200 answered` with the expected
  document and chunk from Supabase FTS;
- optional `service_key` typing was fixed after PostgreSQL exposed an
  `AmbiguousParameter` error; retrieval now requires explicit approved metadata;
- REQUEST gained a trusted OpenClaw submit tool, dashboard list/detail/human
  decision pages, and automated village-scope query coverage;
- a GitHub Actions workflow runs backend, dashboard, and OpenClaw plugin checks;
  hosted run `35424935073` succeeded on merged `main` SHA `81417b0`.

Limitations: knowledge remains demo-only rather than approved village SOP;
REQUEST has not completed a live WhatsApp-to-human-decision run; the two-unit
scope test is automated rather than a live two-village environment; and the
private attachment still needs an HTTP authorization check with two real admin
sessions even though real object storage creation and service read now pass.

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
resolve at that point. The current automated recheck below confirms that the
backend suite no longer has those failures.

## Team runtime report — 2026-09-19

The team later reported that a real WhatsApp test covering text plus photo,
citizen confirmation, ticket visibility in the dashboard, ASK, and TRACK
completed successfully after the AI integration merge (`5da486d`). This is
useful runtime evidence, but the report did not include one shared commit SHA
for every service, exact test identifiers, or the complete authorization and
failure matrix. The corresponding checklist items therefore remain open until
those details are recorded and repeated on the demo environment.

## Automated repository recheck — 2026-09-19

Base commit: `fb106b6` on `feat/frontend-request-residency-letter`, with
documentation-only working-tree updates. Local results:

```text
Backend pytest:             103 passed, 2 dependency deprecation warnings
OpenClaw plugin tests:       6 passed
Dashboard auth tests:        1 passed
Dashboard REPORT tests:      8 passed
Dashboard knowledge tests:   4 passed
Dashboard REQUEST tests:     4 passed
```

These checks confirm the current unit and data-layer baselines. They do not
replace the shared-environment WhatsApp flow, authorization matrix, two-village
isolation, approved ASK source review, or real REQUEST integration gates.


## Finalisasi demo ? pemeriksaan lokal 24 September 2026

Baseline kontrak `0be203d` (PR #40). Implementasi berurutan: gateway `0689337`, backend `d8bb631`, frontend `a27f2c9`, plugin `df73072`. Environment Windows lokal; plugin/eval juga diuji dengan Node 24.16.0. Belum merupakan bukti deployment release candidate.

| Pemeriksaan | Hasil | Sumber/batas |
|---|---|---|
| Backend pytest / Ruff | 231 lulus / lulus | Lokal, dependency eksternal disimulasikan dalam tes |
| Frontend seluruh tests / lint / TypeScript / build | 35 lulus / lulus / lulus / lulus | Lokal; bukan browser E2E login baru |
| Plugin OpenClaw | 20 lulus | Lokal, termasuk AI_DISABLED dan konteks akun/sesi |
| FTS | 35/35 | Fixture deterministik, bukan retrieval Gemini live |
| Eval REPORT / attack / referral | 29/29, 52/52, 7/7 | Deterministik, bukan percakapan WhatsApp |
| Next production lokal `/login` | 200, CSP nonce cocok HTML, nosniff, tanpa X-Powered-By | HTTP localhost:3105 |
| Proxy PDF/logo/foto tanpa sesi | 401 untuk ketiganya | HTTP localhost:3105, UUID sintetis |
| Railway `/health` | 200, status ok | API nyata `laporpak.up.railway.app` |
| Railway `/ready` | 404 | Perubahan readiness belum terpasang |
| Vercel `/login` | 200, CSP/nosniff belum ada | Deployment `laporpak-aptikom.vercel.app`, bukan build lokal baru |
| Status WhatsApp desa dari pengaturan admin | Gagal memuat, layanan bermasalah | UI deployment nyata dengan sesi admin; tidak membuktikan perangkat logout atau host mati |

Tidak ada mutasi laporan, keputusan warga, perubahan kill switch deployment, pairing/logout WhatsApp, upload sumber ASK, atau embedding live dalam pemeriksaan ini. Secret Railway dinyatakan sudah terpasang oleh pengguna, tetapi tidak tersedia dalam environment lokal. Status dua akun WhatsApp/host belum terverifikasi. E2E dua desa, ASK/TRACK live, pengujian CSP browser authenticated, dan review masing-masing role tetap terbuka.
