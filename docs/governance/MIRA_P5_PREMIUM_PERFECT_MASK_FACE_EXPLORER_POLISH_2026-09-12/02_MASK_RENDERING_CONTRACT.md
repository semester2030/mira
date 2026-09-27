# Mask rendering contract (presentation only)

- Geometry: Perfect alpha PNG, `BoxFit.contain`, offset 0 — **UNCHANGED**
- Tint: `ColorFilter.mode(tint, BlendMode.srcIn)` — presentation color only
- Opacity: `SkinFaceMapVisualTokens.maskOverlayOpacity` (0.38)
- Crossfade: `metricCrossfade` / `comparisonSnap`
- Strokes / polygons / landmarks: **0**
- No dilate/erode/warp/offset
