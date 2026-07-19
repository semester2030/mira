# ADR-BA-004 — Engineering Law #34 (Envelope Speech)

**Status:** Accepted · Frozen in AI Beauty Advisor v1.0.0  
**Date:** 2026-07-19

## Context

Hallucination and invented scores destroy trust.

## Decision

**Law #34:** The Advisor may only speak about evidence contained inside the Advisor Evidence Envelope.

No invented evidence, analysis, scores, or recommendations. Missing/stale evidence → acknowledge limitation.

## Consequences

- `assertLaw34` + citation checks mandatory on production turns.  
- Weakening Law #34 requires MAJOR + Independent review.
