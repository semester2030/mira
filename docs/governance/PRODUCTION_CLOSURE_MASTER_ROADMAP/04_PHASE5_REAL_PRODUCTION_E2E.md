# Phase 5 — Real Production End-to-End Acceptance

Status: `PENDING` · Complexity: `HIGH`

## Purpose

Prove controlled physical-device journeys through app, authentication,
backend, real provider, canonical processing, result and UI.

## Entry conditions

Phase 4 PASS; exact candidate deployed; controlled test identity/device;
providers, Redis and Face runtime operational; kill switches available.

## Required journeys

1. Skin: capture → API → Perfect → canonical result → UI.
2. Face: capture/quality → Face pipeline → result/experience/advisor context.
3. Fashion: input → FASHN → garment evidence → Fashion Knowledge/Claim Lock →
   result/UI.
4. Advisor: sealed evidence → real LLM → grounded UI response.
5. Auth/entitlement: login → runtime gate → logout/cache clear → re-login.
6. Failures: provider, Redis/rate limit, invalid input, network interruption,
   retry and safe unavailable state.

## Evidence

For every critical journey: device, auth, backend, real provider, canonical
result, UI and failure behavior. Record minimal sanitized traces, screenshots
and provenance without customer data or secrets.

## PASS / BLOCK / STOP

PASS only when all required critical journeys are `E2E_PROVEN`, with no
synthetic success or trust-law violation. `CODE_PROVEN` or `PROVIDER_PROVEN`
alone is insufficient. Any critical journey failure blocks Phase 6.

Responsibility: Cursor test execution/evidence; Owner controls identity/device
and authorizes activity; vendors provide real responses.

Next gate after owner-approved PASS: `PHASE 6`.
