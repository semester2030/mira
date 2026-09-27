# Phase 3C Final — External Services & Infrastructure Closure

Status: `CURRENT` · Complexity: `HIGH / EXTERNAL DEPENDENCY`

## Purpose

Remove launch-critical account, credential, provider, infrastructure and
runtime uncertainty before candidate deployment. This is not primarily a code
phase.

## Entry conditions

Phase 3B Final PASS; source identity fixed; production source unchanged;
fail-closed provider safety and zero synthetic provider-success fallback.

## Ordered workstreams

1. Read-only account/config discovery.
2. Owner-action resolution and safe test identity.
3. Minimum real Perfect, FASHN and LLM requests.
4. Real response, provenance and canonical mapping validation.
5. Billing/quota/license classification.
6. Firebase valid-token and controlled Storage acceptance.
7. Production Redis existence/reachability/TTL/failure proof.
8. BlazeFace/TFHub delivery decision.
9. Render environment-presence audit.
10. Final external readiness matrix.

## Responsibility

- Cursor: safe probes, adapter tests, evidence and classification.
- Owner: secure credentials, billing/account decisions, explicit authorization.
- External vendor: account/product/quota/license availability.
- Shared: controlled identity and minimum real requests.

## Required evidence

Provider matrix; real responses; account/quota/billing status; canonical
mapping; Firebase controlled identity; Redis status; BlazeFace strategy;
remaining non-blocking owner actions.

## PASS / BLOCK / STOP

PASS only when no launch-critical external UNKNOWN remains and Perfect/FASHN/
LLM valid responses are proven. Provider failure must never look successful.
Any required purchase/upgrade stops that provider as owner billing action.
Secret leakage, customer data use or synthetic success stops the phase.

Next gate after owner-approved PASS: `PHASE 4`.
