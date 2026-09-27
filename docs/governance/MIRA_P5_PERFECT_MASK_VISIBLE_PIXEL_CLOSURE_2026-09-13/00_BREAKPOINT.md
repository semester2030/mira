# MIRA-P5-PERFECT-MASK-VISIBLE-PIXEL-CLOSURE-2026-09-13

## STATUS
**BLOCKED** — awaiting owner physical-iPhone visual confirmation (hot-magenta DIAG on face after tap المسام).

## Prior proven break (still relevant)
`ColorFilter.matrix` luminanceGateFloor was applied in 0–255 space (bias ≈ −100) → GPU alpha = 0.
Fix already landed: `floorN = floor/255`. That alone did **not** close owner visual FAIL.

## This closure — what we prove
Not “bytes exist” / “renderer build ran”.
Criterion: tap **المسام** → face pixels change on physical iPhone.

## Exact Stack layer order (code audit — unchanged geometry)
**BEFORE and AFTER (order already correct; no reorder required):**

1. `ColoredBox(faceOnlyBlack)` — LAYER 1 BLACK
2. `PerfectMaskOverlay` internal Stack:
   - `Image.memory(display)` Apple-matted / original — LAYER 2 SUBJECT
   - tinted Perfect mask `AnimatedOpacity` — LAYER 3 MASK (above subject)
3. DIAG HUD / callout / magnifier / pills — LAYER 4 UI

`showMaskOnly: false` keeps subject+mask in one AspectRatio; mask child is painted **after** subject.

**MASK ABOVE APPLE FACE = YES** (layer order). Visibility still owner-gated.

## Surgical instrumentation (temporary)
1. `SkinFaceMapVisualTokens.maskVisibilityDiagnostic = true`
2. Magenta `srcIn` diagnostic tint (source alpha; geometry untouched)
3. On-device HUD after tap: `state / bytes / rawA / pres / dims / L3>L2`
4. `MASK_CHAIN` + `PERFECT_MASK_OVERLAY_BUILD` debugPrint (works with diagnostic flag outside assert-only)

## How to read the HUD on device
| HUD | Meaning |
|---|---|
| `READY bytes=<n>` with `rawA>0` | Mask data reached session; decoder found non-zero alpha |
| Magenta over face | Renderer + layer order PROVEN |
| `EMPTY_BYTES` / `NO_ARTIFACT` / `NO_SESSION` | Breakpoint = MATERIALIZATION / SESSION — not presentation |
| Label changes but face unchanged + `READY` + no magenta | Breakpoint = EFFECTIVE_ALPHA / paint path |

## Do not leave in production
Set `maskVisibilityDiagnostic = false` after owner confirms visible pixels; restore premium profiles only (already present).

## NOT MODIFIED
Perfect API / analysis / parser / mask geometry / Apple Matte algorithm / black BG / carousel design / capture / backend.
NEW SERVICES / MODELS / STATE OWNERS / RENDERERS = 0
