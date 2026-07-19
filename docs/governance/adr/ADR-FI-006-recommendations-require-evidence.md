# ADR-FI-006 — Recommendations require evidence

**Status:** Accepted · Frozen in v1.0.0  
**Date:** 2026-07-19

## Context

Styling advice must not be free-floating marketing copy.

## Decision

Non-educational recommendations must pass `assertFaceRecommendationEvidence` linking to findings/shape evidence. No Perfect product lock-in.

## Consequences

- Engine id `face-styling-reco-v1` is frozen behavior under Change Policy.  
- Educational disclaimer paths remain allowed when ineligible.
