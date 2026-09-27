# Surgical fix / instrumentation

## Changed files
- `lib/.../perfect_mask_overlay.dart`
  - Prior: luminanceGate bias `floor/255` (kept)
  - Diagnostic magenta `srcIn` (source alpha; geometry untouched)
  - Overlay build `debugPrint` when diagnostic (not assert-only)
- `lib/.../skin_face_map_visual_tokens.dart`
  - `maskVisibilityDiagnostic = true` (TEMPORARY)
  - `diagnosticMaskTint = #FF00AA`
  - tokens version `v11-mask-visible-pixel-closure`
- `lib/.../results_skin_map_panel.dart`
  - On-device MASK_CHAIN HUD (bytes/rawA/pres/dims/state)
  - forceDiagnosticTint + opacity 1.0 when diagnostic
- `test/.../perfect_mask_face_explorer_polish_test.dart` — matrix scale asserts

## NOT created
new service / model / state owner / renderer / cache / Perfect client = 0

## Restore after owner PASS
`maskVisibilityDiagnostic = false` — premium profiles remain as approved.
