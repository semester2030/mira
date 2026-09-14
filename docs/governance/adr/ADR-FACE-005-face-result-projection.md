# ADR-FACE-005 — Face Result Projection

**Status:** Accepted · Frozen in Face Analysis Experience v1.0.0 (`MIRA-FACE-EXPERIENCE-FREEZE-1.0.0`)  
**Date:** 2026-08-11

## Decision
Pure deterministic `FaceResultProjector` (`face-result-projection-v1`) owns public result semantics. No network/LLM/hidden scoring. UI consumes projection, not raw recomputation.
