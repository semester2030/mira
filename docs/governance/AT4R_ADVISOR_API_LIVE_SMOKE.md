# AT-4R — Advisor API Live Smoke

## Status
**NOT EXECUTED** pending `.env.qa` + Nest with QA flags.

## Target
```
POST /api/v1/advisor/chat
```
with structured fashion context → AdvisorService → FKL bridge → real provider → Claim Lock → Envelope.

Local auth: `AUTH_SKIP=true`.
Telemetry: off.
