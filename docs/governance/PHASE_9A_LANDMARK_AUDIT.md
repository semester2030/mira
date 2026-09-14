# Phase 9A — Landmark Audit

**Program:** Mira Face Analysis Experience Transformation  
**Phase:** 9A — Face Analysis Experience Discovery + Architecture Lock  
**Mode:** READ ONLY · NO IMPLEMENTATION  
**Date:** 2026-08-11  
**Verdict context:** Face Intelligence v1.0.0 frozen · Skin Intelligence v1.0.0 frozen · consume-only


| Question | Answer |
|----------|--------|
| Source | MediaPipe Face Mesh on device (`FaceMeshService`) |
| Points | 468 |
| Coordinate system | Normalized image / preview-mapped via `FaceMappingContext` (+ mirror flag) |
| Confidence | Tracking quality enum; not per-landmark public scores |
| Client-side available | YES (live) |
| Persisted | Anchor subset (18) + landmark summary uploaded; raw mesh not in public report |
| Public frozen contract | Summary/eligibility oriented — not full mesh dump |
| Prod UI dots | Debug painter TEST_ONLY (`FaceMapDebugConfig`) |
