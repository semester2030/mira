# Layer order audit

## Required
1. BLACK BACKGROUND
2. APPLE-MATTED REAL USER FACE
3. PERFECT MASK OVERLAY
4. CALLOUT / SCORE / CONTROLS

## Actual BEFORE (Face Explorer)
```
ColoredBox(#000)
 └─ Stack(passthrough)
     ├─ PerfectMaskOverlay(showMaskOnly:false)
     │    └─ Stack
     │         ├─ Image.memory(display)     // Apple matte or original
     │         └─ AnimatedOpacity(mask)     // Perfect tinted mask
     ├─ [UI] DIAG HUD / magnifier / callout / pills
```

## Actual AFTER
**Identical order.** No layer-order bug found. No reorder applied.

MASK ABOVE APPLE FACE = YES

If face covered analysis, order would have been BLACK → MASK → APPLE (face last).
That pattern is **not** present in `results_skin_map_panel.dart` / `perfect_mask_overlay.dart`.
