# MIRA Production Closure Phase 1 — Face C Activation Contract

Decision date: 2026-08-30  
Owner decision: **Experience OFF / Processing allowed**

## Normative decision

`MIRA_FACE_EXPERIENCE_MASTER_ENABLED` is the server-authoritative master for
the new Face Experience only. It controls the runtime `faceExperienceV1`
entitlement consumed by the Phase 9C capture mirror, Phase 9D analysis motion,
and Phase 9F result mirror.

It is **not** a Face/Skin processing kill switch.

With the master OFF:

- 9C Interactive Capture Mirror is OFF.
- 9D Soft Laser / Analysis Motion is OFF.
- 9F Interactive Result Mirror is OFF.
- Existing Skin → Face processing remains allowed.
- Existing analysis persistence remains allowed.
- Existing `/api/v1/ai/skin-analysis` and `/api/v1/skin-analysis` routing
  remains allowed.
- Existing report response/history routing remains allowed, including legacy
  stored Skin compatibility and the deprecated `skin` response sibling.
- Advisor use of authoritative Face context already stored with an analysis
  remains allowed.

The master must not be read by Skin Analysis, Face Intelligence, persistence,
legacy report routing, or stored Face advisor-context code. Those paths retain
their existing authentication, subscription, quality, safety, provenance, and
confidence controls.

## Truth table

| Master | UID allowlisted | `faceExperienceV1` | 9C/9D/9F | Legacy processing, persistence, reports, advisor context |
|---|---:|---:|---|---|
| OFF or missing | No/Yes | OFF | OFF | Allowed under existing controls |
| ON | No | OFF | OFF | Allowed under existing controls |
| ON | Yes | ON | Eligible; build flags still apply | Allowed under existing controls |

An invalid or stale entitlement remains fail-closed for the new experience.
That fail-closed behavior does not disable legacy processing.

## Frozen boundaries

This closure does not change:

- Skin Intelligence or Face Intelligence engines;
- `runFaceReportPipeline` or `report.pipeline.ts`;
- Face Experience Laws #40 or #41;
- report formulas, confidence, eligibility, or provenance meaning;
- Render configuration, production secrets, deployment, or publishing.

## Verification

Focused test:

```text
mira-api/src/production-entitlements/phase-prod-closure1-face-activation.schema-tests.ts
```

Run from `mira-api`:

```bash
npx ts-node --transpile-only src/production-entitlements/phase-prod-closure1-face-activation.schema-tests.ts
```

The test covers:

1. allowlisted Experience OFF/ON entitlement outcomes;
2. runtime endpoint projection;
3. legacy Skin controller delegation;
4. V2 persistence payload, legacy stored-result extraction, and legacy response
   sibling routing;
5. source-boundary guards preventing the Face experience entitlement from
   entering processing, persistence, result routing, or stored Face advisor
   context.

## Boundary not executed end-to-end

The focused schema harness does not invoke provider-backed image analysis,
Prisma, or a full Advisor turn. Doing so would require broad integration
fixtures and provider/database setup outside Face C scope. Those boundaries are
covered here by direct pure-helper checks and source-level dependency guards;
the frozen engine behavior itself is intentionally not reworked or mocked.
