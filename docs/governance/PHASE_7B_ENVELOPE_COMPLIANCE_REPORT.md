# Phase 7B — Envelope Compliance Report

**Envelope version:** `advisor-envelope-v1`  

## Required fields (implemented)

Envelope ID · Session ID · Evidence IDs · Subsystem IDs · Confidence · Limitations · Allowed Claims · Forbidden Claims · Freshness · Citations · Capabilities Used · Traceability · Version · `sealed: true`

## Rules

- Immutable after seal (`Object.freeze`)
- No provider payloads
- No Canonical* / Decision Ledger / BE internals
- Planner consumes envelope only
- Grounded response cites `allowedClaims` only

## Validation

`validateEnvelopeCompleteness` · orphan citation checks · subsystem allowlist · Law #34 claim checks
