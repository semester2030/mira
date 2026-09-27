# L0–L5 — ResultsSkinMapPanel

| Layer | What | Symbol | Z |
|-------|------|--------|---|
| L0 | Pure black | `ColoredBox(faceOnlyBlack)` | 0 |
| L1 | Apple subject / original | PerfectMaskOverlay source | 1 |
| L2 | Perfect concern PNG | PerfectMaskOverlay mask | 2 |
| L3 | Magnifier/callout | UI annotation | 3 |
| L4 | Metric surface tint | NONE after softPresence=0 | — |
| L5 | Carousel/score | outside stage | — |

Internal isolation: `MIRA_FX_HIDE_SUBJECT`, `MIRA_FX_HIDE_PERFECT_MASK`, `MIRA_FX_HIDE_UI_ANNOTATION`

## Legacy NOT in Face Explorer
- `wrinkle_line_painter.dart` — BeautyReportFaceMap only
- `heatmap_overlay_painter.dart` — BeautyReportFaceMap only
- `landmark_face_region_session.dart` — unused by panel
- `SkinGeometryDebugMode` — never referenced
