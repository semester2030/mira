# MIRA-P5-SKIN-FACE-MAP-PREMIUM-INTERACTION-2026-09-11

## Architecture

| Layer | Source | Production use |
|---|---|---|
| ANATOMICAL_GEOMETRY | `SkinReportRegionBuilder` + MediaPipe landmarks | unchanged source of truth |
| HIT_TEST_GEOMETRY | `toLinearPath()` → `hitPaths` | face taps only |
| VISUAL_REGION_PATH | `SkinFaceMapVisualPathBuilder` (Catmull-style cubic + shrink + hit-shell clip) | selected soft fill only |

## Smoothing method

1. Simplify landmark ring (8–10 pts, region-specific)
2. Shrink toward centroid (4–7%) — prevents Bezier balloon
3. `SmoothPathBuilder.fromPoints` with region-specific tension
4. Intersect with hit path scaled 1.05 around centroid
5. Reject if visual bounds expand >6% vs hit → fallback `toPath(smoothness: 0.22)`

## Production paint

- No linear debug polygons
- Soft fill (α≈0.14) + soft edge (α≈0.22, 1.1px) + blur glow
- Tokens: `SkinFaceMapVisualTokens` from `AppColors`
- Debug linear outlines only when `MIRA_SKIN_GEOMETRY_DEBUG`

## Under-eye

Chips include under-eye; Skin report builder may omit under-eye polygons → face tap not in critical set (forehead/cheeks/nose/chin). Status: NOT SUPPORTED for critical face tap until builder emits under-eye.

## Owner video

Leave candidate on iPhone — OWNER VISUAL APPROVAL = PENDING.
