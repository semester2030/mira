# MIRA-P5-PERFECT-MASK-RENDER-CHAIN-FIX-2026-09-13

## ROOT CAUSE (proven)
`PerfectMaskOverlay._presentationAlphaMatrix` used `luminanceGateFloor` as a **0–255** bias inside Flutter `ColorFilter.matrix`, which operates in **0.0–1.0** component space.

Example (pores floor=70, gain=1.55):
- Bug: bias ≈ `-70 * 1.55 = -108.5` → every GPU alpha clamped to 0
- Fix: bias = `-(70/255)*1.55 ≈ -0.425`

CPU unit tests (`presentationAlphaFromPerfectRgba`) used 0–255 correctly → false confidence that “bytes exist ⇒ visible”.

## BREAKPOINT
**RENDERER** (ColorFilter.matrix bias scale) — after TAP / MAPPING / SESSION / BYTES / DECODE all could PASS while face stayed unchanged.

## PORES TRACE (engineering)
| Stage | Result |
|---|---|
| USER TAP | PASS |
| selectedMetric | PASS |
| canonical ID → hd_pore | PASS (single mapper) |
| PerfectMaskSession lookup | PASS when bytes present |
| materialization | READY from ephemeralMasks (no new Perfect task) |
| decode | PASS (Image / package:image) |
| non-zero presentation samples (CPU 0–255) | PASS when lesions exist |
| ColorFilter GPU alpha (before fix) | **FAIL** (bias −100s) |
| ColorFilter GPU alpha (after fix) | PASS (bias ∈ (−1,0)) |
| Layer order BLACK→APPLE→MASK→UI | PASS (mask above subject) |

## FIX
1. Normalize floor: `floorN = luminanceGateFloor / 255.0` in matrix bias.
2. Treat missing session/empty bytes as `unavailable` (no silent selected-only).
3. Sanitized `MASK_CHAIN` debugPrint on tap (no payloads).

## NOT MODIFIED
Apple Matte, black BG, Perfect API/parser/geometry, capture, carousel design, scores.

## Changed files
- `perfect_mask_overlay.dart` — matrix bias scale
- `results_skin_map_panel.dart` — unavailable + chain trace
- `skin_face_map_visual_tokens.dart` — signal sample counter
- polish tests — matrix scale + canonical mapping

## Duplication
NEW SERVICES/MODELS/OWNERS/RENDERERS = 0

## Physical iPhone
Profile build installed + launched. Owner must confirm visible masks on video.
OWNER VISUAL APPROVAL = PENDING
