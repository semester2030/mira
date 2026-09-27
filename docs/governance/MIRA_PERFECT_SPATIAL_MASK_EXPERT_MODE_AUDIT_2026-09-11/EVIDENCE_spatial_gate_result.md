# Phase 5a — Spatial Spike Gate Result

**Date:** June 2026  
**Verdict:** `5b-fallback`

## YouCam S2S skin-analysis (current)

- Response shape: `results.output[]` with `type` + `ui_score` per concern
- No `mask`, `mask_url`, `coordinates`, `landmarks`, or `region_scores` in production responses
- Parser: `perfect-corp.service.ts` → `extractConcerns()` (global only)

## Gate implementation

- `mira-api/src/intelligence/pipeline/spatial-spike.ts`
- `detectSpatialCapability(rawTaskData)` returns:
  - `verdict: '5b-fallback'`
  - `spatialConfidence: 'none'`

## Product decision

Ship **Concern Zones (narrative only)** with disclaimer.  
Do **not** ship face markers until Perfect Corp returns real spatial data.

## When API upgrades

If `region_scores` or `mask_url` appear in output:

1. Spike returns `5b-true-regional` or `5b-true-pixel`
2. `face-zone-mapper` enables `faceMap` with API-sourced zones
3. Flutter `FaceHealthMap` renders (guarded by `hasSpatialFaceMap`)
