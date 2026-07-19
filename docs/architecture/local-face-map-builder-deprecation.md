# LocalFaceMapBuilder Deprecation Plan

**Phase:** 4F (plan) · Removal scheduled after Face Intel report path is production-default  
**Status:** DEPRECATED (still present for guest/legacy offline skin maps)  
**Owner:** Flutter `lib/features/intelligence`

## Current role

`LocalFaceMapBuilder` builds an **educational offline FaceHealthMap** for guest / legacy skin reports when server spatial map is absent. It is **skin-concern oriented**, not Face Intelligence geometry/shape.

## Why deprecate

Architecture Lock: parallel client face-map logic competes with:

1. Server `faceHealthMap` (skin concerns)  
2. Sibling `faceIntelligence` report (geometry · shape · styling)  

Keeping both long-term risks users confusing skin heatmap with measured Face Intel.

## Deprecation stages

| Stage | Action | Gate |
|-------|--------|------|
| **4F (now)** | Mark `@Deprecated` + this plan; Face Intel validation suite green | Done in 4F |
| **Post-4F** | Prefer `mira.faceIntelligence` section when present; keep LocalFaceMapBuilder only for guest skin heatmap fallback | Product approval |
| **Cleanup** | Remove builder once guest path uses server FaceHealthMap narrative-only or explicit offline skin DTO | Explicit approval |

## Must not do in 4F

- Delete `LocalFaceMapBuilder` without replacement for guest skin heatmap  
- Redirect LocalFaceMapBuilder output into `faceIntelligence` schema  
- Change skin FaceHealthMap semantics to carry geometry ratios  

## Replacement direction

- Skin spatial/narrative concerns → `FaceHealthMap` / concern zones (existing)  
- Face shape / geometry / styling → `FaceIntelligenceReport` sibling only  

## Tracking

Portal: `#phase4f-report` · Contract: `face_validation_contract.md`
