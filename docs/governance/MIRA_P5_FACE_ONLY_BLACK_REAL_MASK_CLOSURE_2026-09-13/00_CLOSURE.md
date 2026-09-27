# MIRA-P5-FACE-ONLY-BLACK-REAL-MASK-CLOSURE-2026-09-13

## Implementation summary
Integrated Apple `VNGeneratePersonSegmentationRequest` (.accurate) matte into the **existing** Face Explorer (`ResultsSkinMapPanel` + `PerfectMaskOverlay`).

### Face-only black
- On ephemeral image load → on-demand MethodChannel matte (not app bootstrap).
- Display base = Apple black composite `#000000` (same W×H as oriented source).
- Press-hold → ORIGINAL room image; release → face-only black + Perfect mask.
- Stage `ColoredBox(faceOnlyBlack)`.

### Metric taps change the face
- Carousel **only** lists metrics with real Perfect mask bytes (no selected-state-only / dead metrics).
- `PerfectMaskOverlay` keyed by mask identity + presentation profile so each tap rebuilds visibly.
- Session-backed oiliness (`hd_oiliness`) remains in carousel via existing union.
- Stronger luminance-gate profiles: pores, oiliness, wrinkles, pigmentation, acne, redness, texture, hydration.

### Alignment
- Matte dims must equal source dims (hard fail → no face-only; warning shown).
- No Perfect API / geometry / capture changes.
- No second renderer / service / repository.

### Build
- **Profile** install (home-screen safe; Debug home-launch was prior crash root cause).

## Changed files
- `lib/features/results_experience/presentation/widgets/results_skin_map_panel.dart`
- `lib/features/results_experience/presentation/geometry/skin_face_map_visual_tokens.dart`
- `test/results_experience/perfect_mask_face_explorer_polish_test.dart`
- Reuses: `apple_person_matting_poc_bridge.dart` + iOS `ApplePersonMattingChannel` (no new owner)

## Duplication audit
ACTIVE DUPLICATE RESPONSIBILITIES = 0

## Tests / analyze
- `flutter analyze` (touched paths): No issues found
- `perfect_mask_face_explorer_polish_test` + `perfect_mask_session_test`: All passed

## Physical iPhone
- Device installed + launched (profile)
- OWNER VISUAL APPROVAL = PENDING (continuous video by owner)

## Gates pending owner eyes
BLACK / FACE ONLY / HAIR / JAW / tap <1s visual response
