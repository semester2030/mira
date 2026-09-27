# Changed-file manifest (presentation only)

## Flutter
- `lib/features/results_experience/presentation/widgets/results_skin_map_panel.dart` — face-first layout, progressive التفاصيل, soft chips, Arabic mapping reuse
- `lib/features/results_experience/presentation/widgets/perfect_mask_overlay.dart` — fadeDuration only (geometry unchanged)
- `lib/features/results_experience/presentation/geometry/skin_face_map_visual_tokens.dart` — softer opacity + semantic accents from AppColors
- `lib/features/results_experience/semantics/metric_presentation_policy.dart` — ONE presentation map + hints
- `lib/features/results_experience/truth/skin_claim_policy.dart` — shorter disclaimer copy

## Tests
- `test/results_experience/perfect_mask_face_explorer_polish_test.dart` (new)
- `test/results_experience/skin_face_map_truthful_contract_test.dart`
- `test/results_experience/phase8d_metrics_map_test.dart`

## NOT changed
- PerfectCorpService / PerfectCorpSkinProvider
- perfect-hd-mask.parser
- PerfectMaskSession decode/download contract
- capture / camera / thresholds
- backend APIs
