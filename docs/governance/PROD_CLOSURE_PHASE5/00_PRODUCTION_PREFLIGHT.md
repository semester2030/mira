# Phase 5 — Production Preflight

Task: `MIRA-P5-PHYSICAL-IPHONE-E2E-2026-08-31`

Short fresh preflight only. Not a Phase 4 rerun.

## Production identity

- Live API: `https://mira-api-n4p3.onrender.com/api/v1`
- Live source SHA: `d6a316be6aabaee8123d94584866d23e3cfd5187`
- Local git HEAD: same SHA

## HTTP

| Route | Result |
|---|---|
| `/health` | 200 `ok` |
| `/website/features` | 200 |
| `/website/stats` | 200 |
| `/entitlements/runtime` unauthenticated | 401 |

PostgreSQL is treated healthy from live DB-backed website stats (200).
Firebase Auth guard is available (entitlements 401, not unconfigured 503).

## Runtime notes (not a Phase 4 re-audit)

- Perfect Corp production mock fallback: **not allowed**
- Redis: `configured=true`, health state `DEGRADED`, critical controls
  `fail_closed` (known fail-closed design; not re-opened as a new Phase 5
  blocker without a device E2E failure)
- BlazeFace: `AVAILABLE`
- Phase 4 entitlement closure (`55_PHASE4_ENTITLEMENT_CLOSURE.md`): still
  valid. Allowlist empty; masters/Advisor/LLM OFF until a later bounded
  owner canary is authorized for device journeys.

## Device

Physical iPhones are visible to the Mac as **offline**. No device evidence
is claimed.

## Gate

Preflight: **CONTINUE**
Physical iPhone: **NOT PROVEN**
Phase 5: **WAITING FOR OWNER DEVICE EVIDENCE**
