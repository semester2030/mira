# Phase 3C Final — Existing Config Presence (after CLI visibility)

Date: 2026-08-31

Mode: read-only. No production mutation, env change, secret printing, deploy,
or paid provider request.

Render MCP remained `unauthorized`. Presence was read from the already
authenticated local Render CLI session against `mira-api`
(`srv-d85ngcfavr4c73d3rk6g`) and from authenticated Firebase APIs. Values were
never printed.

## Environment variable presence on `mira-api`

| Variable | Presence |
|---|---|
| `FASHN_API_KEY` | PRESENT |
| `FASHN_BASE_URL` | PRESENT |
| `LLM_API_KEY` | PRESENT |
| `LLM_BASE_URL` | PRESENT |
| `LLM_MODEL` | PRESENT |
| `REDIS_URL` | MISSING |
| `FIREBASE_PROJECT_ID` | PRESENT |
| `GOOGLE_APPLICATION_CREDENTIALS` | PRESENT |
| `DATABASE_URL` | PRESENT |
| `PERFECT_API_KEY` | PRESENT |
| `PERFECT_BASE_URL` | PRESENT |
| `PERFECT_CORP_API_KEY` | MISSING (alias unused; primary `PERFECT_API_KEY` is PRESENT) |
| `BLAZEFACE_MODEL_LOAD_TIMEOUT_MS` | MISSING (optional; source default remains 20000 ms) |

`mira-api` has no linked env groups. Workspace Render Redis/Key Value count
remains `0`. Therefore `REDIS_URL` is not hidden in a group: it is absent.

## Root-cause classification

| Item | Classification |
|---|---|
| Render `mira-api` service | EXISTS_AND_VISIBLE |
| PostgreSQL `mira-db` / `DATABASE_URL` | EXISTS_AND_VISIBLE |
| Perfect Corp config | EXISTS_AND_VISIBLE |
| Perfect real response | ACCEPTANCE_TEST_ONLY_REMAINING |
| FASHN config | EXISTS_AND_VISIBLE |
| FASHN real response | ACCEPTANCE_TEST_ONLY_REMAINING |
| LLM config | EXISTS_AND_VISIBLE |
| LLM real response | ACCEPTANCE_TEST_ONLY_REMAINING |
| Firebase Admin (`FIREBASE_PROJECT_ID` + `GOOGLE_APPLICATION_CREDENTIALS`) | EXISTS_AND_VISIBLE |
| Firebase Auth project config | EXISTS_AND_VISIBLE |
| Valid controlled Firebase identity E2E | ACCEPTANCE_TEST_ONLY_REMAINING |
| Firebase Storage rules release | ACTUALLY_MISSING |
| Production Redis / `REDIS_URL` | ACTUALLY_MISSING |
| BlazeFace strategy / optional timeout env | EXISTS_AND_VISIBLE (timeout env optional) |

Firebase Rules API: 1 Firestore release, 0 Storage releases.
Authenticated Storage bucket list returned no buckets. Client source still
declares a bucket name; production Storage rules are not a deployed release.

## Minimal real-acceptance plan (not executed)

Only after owner approval, using synthetic non-customer assets:

1. Perfect: one MIRA adapter task → poll → map; `SYNTHETIC_REPLACEMENT=NO`.
2. FASHN: one canonical Vision Platform request → map; mock=false.
3. LLM: one canonical structured adapter request → parser; mock=false.
4. Firebase Auth: one dedicated data-free test identity against a safe route.
5. Redis: cannot start until `REDIS_URL` exists; do not create a service in
   this step.
6. Storage: cannot production-accept until a Storage rules release exists;
   do not deploy rules in this step.

Paid provider requests were not executed.
