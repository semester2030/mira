# Phase 3C Final — Execution Continuation Evidence

Date: 2026-08-31
Source: `4b2c78ac42fef38dc0012a35ba6879ae4d6a4a74`

## Scope and safety

- Phase 3C Final only; Phase 4 not started.
- Product source modified: NO.
- Customer data/media/token used: NO.
- Secret printed or committed: NO.
- Paid plan, upgrade or contract accepted: NO.
- Provider requests: exactly one per Perfect, FASHN and LLM.

## Production Redis closure

The existing source consumes `REDIS_URL` through `ioredis`. Critical rate and
quota counters use `INCR` + bounded expiry and fail closed; optional FAQ cache
fails open. No code change was required.

A Render Key Value instance was created with:

- name: `mira-redis`;
- plan: `free`;
- region: `oregon`, matching `mira-api`;
- maxmemory policy: `noeviction`;
- persistence: `off` (free-plan limitation);
- external access after verification: disabled.

Its internal connection string was written to `mira-api` as `REDIS_URL`
without printing it. Verification used a temporary single-IP allow entry that
was removed afterward:

- TLS: PASS;
- AUTH: PASS;
- PING: PASS;
- write/read/TTL/delete: PASS;
- test key cleanup: PASS;
- temporary external access cleanup: PASS.

Phase 3B Redis critical-control regression: PASS.
`NO_UNLIMITED_AI_ACCESS = PASS`.

## Firebase Auth real acceptance

A random, data-free email/password technical identity was created through the
normal enabled Firebase Auth flow. No token or credentials were printed or
stored.

- valid token → live MIRA read-only history route: HTTP 200;
- invalid token: HTTP 401;
- missing token: HTTP 401;
- technical identity deleted: PASS.

`FIREBASE VALID IDENTITY = PROVEN`.

## Provider real acceptance

### Perfect Corp

One real provider-service `PerfectCorpService.analyzeSkin()` transaction used
the tracked synthetic face artwork. The canonical
`PerfectCorpSkinAdapter.analyze()` wrapper was not exercised, so this attempt
does not prove the complete MIRA adapter contract.

- configured: YES;
- elapsed: 11,904 ms (`OBSERVED SAMPLE ONLY`);
- real canonical response: NOT PROVEN;
- failure category captured by the sanitized runner: OTHER;
- synthetic replacement: NO.

No retry was made because authorization allowed one request. Account/quota,
network/upload/task or provider-response diagnosis remains required. A future
authorized acceptance must enter through `PerfectCorpSkinAdapter`, force
`PERFECT_CORP_FALLBACK_MOCK=false`, and prove `meta.isMock=false` plus all
eight required concern mappings.

### FASHN

One real canonical `FashnGeometryProvider.segment()` transaction used a
non-personal catalog illustration converted to JPEG.

- auth accepted: YES;
- real task: YES;
- real response: YES;
- schema: PASS;
- canonical mapping: PASS;
- segments: 1;
- mock: NO;
- synthetic fallback: NO;
- latency: 4,672 ms (`OBSERVED SAMPLE ONLY`).

`FASHN REAL RESPONSE = PROVEN`.

### LLM

One real request ran through `OpenAiFashionKnowledgeLlmProvider` and
`runFashionKnowledgeLlm()` with retries forced to zero.

- configured: YES;
- real response: YES;
- structured parser: PASS;
- mock: NO;
- draft validation: BLOCKED;
- Claim Lock reached: NO;
- runtime stage: `draft_validation`;
- attempts: 1.

The fail-closed validation prevented untrusted output from becoming advice.
This proves response and parser acceptance but not full Claim Lock acceptance.
No code defect is confirmed without the discarded provider payload or another
separately authorized request.

## Firebase Storage owner checkpoint

Authenticated evidence shows:

- Firebase project: exists;
- Auth config: enabled;
- registered apps: 7;
- Firestore database: exists in `asia-south1`;
- default Storage bucket: absent;
- Storage Rules releases: 0;
- project default GCP resource location: not set.

Current Firebase policy requires Blaze billing to provision a new default
Storage bucket. Bucket location is immutable. Therefore no bucket, billing
upgrade, location choice or rules deployment was performed.

`OWNER_DECISION_REQUIRED`:

1. approve or reject Blaze pay-as-you-go for this project;
2. choose the permanent bucket location.

Relevant factual choices include `us-west1`, `us-central1` and `us-east1`
(Cloud Storage Always Free locations while Blaze remains required), or
`asia-south1` to align with the existing Firestore location. Render is in
Oregon. The owner must decide using user geography, latency, data residency
and cost requirements.

After owner approval: create the default
`mirra-14b0e.firebasestorage.app` bucket, deploy only reviewed Storage rules,
then run the controlled upload/read/delete test.

## Global safety

- Perfect provider failure → fake success: 0;
- FASHN provider failure → synthetic success: 0;
- LLM invalid draft → trusted answer: 0;
- Redis failure → unlimited AI: 0;
- BlazeFace failure → fake face result: 0.

`PROVIDER_FAILURE_SUCCESS_COUNT = 0`.
