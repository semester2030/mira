# ADR-OI-004 — Evidence → Metrics → Confidence

**Status:** Accepted · Frozen in Outfit Intelligence v1.0.0  
**Date:** 2026-07-19

## Context

Confidence must not be invented without metrics grounded in evidence.

## Decision

Pipeline order after engines:

Evidence Graph (finalized) → Metrics Engine → Confidence Engine → Limitations / Explainability → CanonicalOutfit

Confidence uses versioned `OUTFIT_CONFIDENCE_WEIGHTS_V1`. No confidence without evidenceIds.

## Consequences

- Skipping Metrics or inventing confidence outside this chain is forbidden without MAJOR CR.  
- Weight calibration is PATCH/MINOR under versioned weights policy.
