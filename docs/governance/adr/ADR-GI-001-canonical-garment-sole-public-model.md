# ADR-GI-001 — CanonicalGarment is the sole public garment model

**Status:** Accepted · Frozen in v1.0.0  
**Date:** 2026-07-19

## Context

Vision produced `FashionVisionDocument`; ports historically exposed `DetectedGarment` alongside it.

## Decision

`CanonicalGarment` (`garment-schema-v1`) is the only public garment model on `FashionAnalysisPort` and `POST /ai/vision/outfit/analyze`. `FashionVisionDocument` and `DetectedGarment` are internal.

## Consequences

- Flutter must migrate to Canonical garments.  
- Outfit/Styling phases consume CanonicalGarment, not provider docs.
