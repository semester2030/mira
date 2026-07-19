# Skin Vitality Index v2

## Identity

| Field | Value |
|-------|--------|
| Version | `svi-v2` |
| Formula id | `svi-v2-dynamic-denom` |
| Provenance calculationVersion | `svi-v2` |

## Rules

- Weighted metrics with **dynamic denominator**
- Unavailable metrics are **excluded** (never filled with 0/average/neutral)
- Confidence attached to the score
- Positive and negative contributors stored
- Score explanation AR/EN
- Must never claim: beauty ranking, medical health, clinical diagnosis

## Inputs

Canonical metrics only (health-oriented 0–100 when available).

Optional capture confidence multiplies score/confidence conservatively.

## Implementation

`mira-api/src/intelligence/skin-intelligence/svi-v2.engine.ts`

Legacy `computeBeautyScore` remains for older tests/utilities but **new analyses** use SVI v2 via `IntelligenceService.buildBeautyReport`.

Storage field name remains `overallBeautyScore` for compatibility; display labels remain Skin Vitality Index.
