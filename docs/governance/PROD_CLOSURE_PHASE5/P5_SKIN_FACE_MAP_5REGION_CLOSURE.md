# P5 — SKIN FACE MAP 5-REGION CLOSURE

**Task:** `MIRA-P5-SKIN-FACE-MAP-5REGION-CLOSURE-2026-09-10`  
**Date:** 2026-09-10

## Owner rejection addressed

Prior polygons bled into hair / background / eyes. Root causes:

1. Live `leftCheek`/`rightCheek` loops included lower-eyelid indices.
2. Forehead used full top-arc (no hairline in Face Mesh → over-claim).
3. Bezier `toPath()` bulged outside landmark hulls.
4. Debug landmarks were gated behind `kDebugMode` only.

## Fix

| Change | Detail |
|--------|--------|
| `SkinReportRegionBuilder` | Report-only conservative 5 regions |
| Forehead | Brow-anchored; rise factor **0.42** toward top support (not hairline) |
| Cheeks | Malar-only indices; vertical band brow→lip; nose midline clearance; 0.82 inset |
| Nose | Landmark loop + 0.88 centroid inset |
| Chin | Tight chin arc; starts below lip; 0.85 inset |
| Paths | `toLinearPath()` — no bezier bulge |
| Debug | `--dart-define=MIRA_SKIN_GEOMETRY_DEBUG=true` works in release |

## Landmark source

MediaPipe Face Mesh — **468** points. Session requires count ≥400 + all 5 critical paths.

## Same image

Ephemeral analyzed JPEG → `FaceMeshService(regionBuilder: SkinReportRegionBuilder)` → same viewport as `BoxFit.cover` image.

## Automated

`skin_face_map_landmark_precision_test.dart` — centroid 5/5, interior 100%, negatives 0, multi-face, cheek bleed exclusion, forehead factor.

## Physical iPhone

Installed with geometry debug define for owner raw-landmark verification.  
**10-tap matrix: NOT RUN by Cursor → FACE MAP FOUNDATION = BLOCKED** until owner completes 10/10.

## Icons / polish / Phase 6

LOCKED — not performed.
