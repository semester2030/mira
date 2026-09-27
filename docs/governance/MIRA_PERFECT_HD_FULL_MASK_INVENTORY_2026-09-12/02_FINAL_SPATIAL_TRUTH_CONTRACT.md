# Final Spatial Truth Contract

## PerfectSpatialSkinConcern

Required fields:
- `providerType`
- `rawScore`
- `uiScore` (separate; never overwrite raw)
- `spatialMode`: `PROVIDER_PIXEL_MASK` | `PROVIDER_SUBREGION_MASKS` | `SCORE_ONLY`
- `maskRefs` (ephemeral only)
- `subregions[]`
- `sourceWidth` / `sourceHeight`
- `maskWidth` / `maskHeight`
- `temporaryLifecycle` = `EPHEMERAL_SESSION_ONLY`
- `landmarkFallback` = **false** always

## Absolute visual truth rule

Spatial overlay **only** when `spatialMode` is `PROVIDER_PIXEL_MASK` or `PROVIDER_SUBREGION_MASKS`.

If `SCORE_ONLY`: no face heatmap, no fake mask, no landmark concern polygon.

## Source of truth for skin concern location

**PERFECT PROVIDER MASK** — not MIRA landmark templates.

## Legacy landmark concern map

`DEPRECATED_FOR_SKIN_CONCERN_VISUALIZATION`  
Face Mesh infrastructure may remain for other valid features.
