# Recommendation Engine (Phase 3)

## Goals

Evidence-backed **cosmetic** recommendations only.

## Required fields per recommendation

- Evidence (metric ids, finding ids, values)
- Confidence
- Reason (AR/EN)
- Priority
- Category: morning | night | weekly | lifestyle | professional_consultation | educational
- `cosmeticOnly: true`

## Forbidden

- Prescribing medication
- Diagnosing disease
- Inventing evidence for unavailable metrics

## Implementation

`mira-api/src/intelligence/skin-intelligence/recommendation.engine.ts`

Educational disclaimer is always included.
