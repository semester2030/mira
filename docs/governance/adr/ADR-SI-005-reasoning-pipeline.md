# ADR-SI-005 — Reasoning Pipeline Ownership

**Status:** Accepted · Frozen in Styling Intelligence v1.0.0  
**Date:** 2026-07-19

## Context

Styling must not re-implement Skin/Face/Garment/Outfit analysis.

## Decision

Pipeline:

Frozen inputs → Evidence Interpretation → Reasoning → Style Decisions / Goals / Progress → Canonical Styling Profile (+ internal ledger)

Styling owns interpretation and reasoning only. Analysis/evaluation remain upstream frozen subsystems.

## Consequences

- Calling GI/OI engines from Styling for “re-analysis” is forbidden.  
- Recommendation/shopping remain out of pipeline.
