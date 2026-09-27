# MIRA metrics completeness review

## Verdict

List source fixed: Face Explorer no longer drops PerfectMaskSession results that
are absent from `map.concerns`. Default UI always shows six primary metrics in
approved RTL 3×2 order. Extras sit behind «كل المؤشرات» / «إخفاء المؤشرات الإضافية».

**Device visual verification was not completed in this delivery** — see `01_DEVICE_STATUS.md`.

## Code changes

| File | Role |
|---|---|
| `face_explorer_concern_catalog.dart` | Merge map + `providersWithLegitimateResult` + report scores; primary slots; gap reasons |
| `face_explorer_metrics.dart` | RTL grid; expand button with icon; honest analyzing/unavailable chip labels |
| `results_skin_map_panel.dart` | Use catalog; no fabricated score/map for empty slots |
| `face_explorer_metrics_completeness_test.dart` | Nine unit cases |

## Primary order (approved)

1. المسام `pores` 2. التجاعيد `wrinkles` 3. الحبوب `acne`
4. التصبغات `pigmentation` 5. الترطيب `hydration` 6. الدهون `oiliness`

## Build

`1.0.0+2026091801`
