# ADR-FI-003 — Beauty / attractiveness score is forbidden in Face Intelligence

**Status:** Accepted · Frozen in v1.0.0  
**Date:** 2026-07-19

## Context

Product and Architecture Lock ban attractiveness scoring.

## Decision

Face Intelligence must never emit an attractiveness or “beauty score” for facial features. Skin Vitality Index remains a **skin** construct with cosmetic labeling.

## Consequences

- Auditors (`auditAttractivenessBan`) fail on violations.  
- Recommendations are educational/styling, not ranking attractiveness.
