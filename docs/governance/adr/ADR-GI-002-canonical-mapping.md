# ADR-GI-002 — Canonical mapping owns Vision → Garment

**Status:** Accepted · Frozen in v1.0.0  
**Date:** 2026-07-19

## Context

Need a Mira-owned path from vision observations to wardrobe-stable garments without dumping vendor payloads.

## Decision

Garment Intelligence Mapping Engine (classify → normalize → attributes → catalog → confidence → limitations → explainability) is the sole production mapper from internal `FashionVisionDocument` to `CanonicalGarment[]`.

## Consequences

- Adapters must not invent parallel public garment DTOs.  
- Engine behavior is frozen under Change Policy.
