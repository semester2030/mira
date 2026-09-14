# Phase 9A — Interactive Mirror Architecture

**Program:** Mira Face Analysis Experience Transformation  
**Phase:** 9A — Face Analysis Experience Discovery + Architecture Lock  
**Mode:** READ ONLY · NO IMPLEMENTATION  
**Date:** 2026-08-11  
**Verdict context:** Face Intelligence v1.0.0 frozen · Skin Intelligence v1.0.0 frozen · consume-only


## Desired state machine (conceptual)
SEARCHING_FACE → FACE_FOUND → ALIGNING → LIGHT_CHECK → DISTANCE_CHECK → POSE_CHECK → HOLD_STILL → READY → AUTO_CAPTURE? → CAPTURED → ANALYZING → REVEAL

## Feasible with current stack
Most states map to existing gate signals. AUTO_CAPTURE optional (D1). ANALYZING/REVEAL are presentation layers consuming frozen reports.

## Honesty rule
Pre-capture overlays = CAPTURE GUIDANCE only — never Face Intelligence results before API returns.
