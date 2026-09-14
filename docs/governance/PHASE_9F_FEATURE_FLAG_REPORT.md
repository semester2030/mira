# PHASE 9F — Feature Flag Report

| Flag | Dart-define | Default | Wrapper |
|---|---|---|---|
| `faceResultMirrorV1` | `MIRA_FACE_RESULT_MIRROR_V1` | **false** | `FaceResultMirrorFlag.enabled` |

## Behavior
| Condition | Surface |
|---|---|
| Flag OFF | Legacy `MiraBeautyReportScreen` or Results V2 (unchanged) |
| Flag ON + fresh analysis | `ResultsFaceMirrorScreen` |
| Flag ON + history / `forceLegacy` | Legacy / V2 (no mirror) |
| Mirror → «عرض التقرير الكامل» | Legacy via `forceLegacy: true` |

## QA enable
```
--dart-define=MIRA_FACE_RESULT_MIRROR_V1=true
```
Optional continuity with 9D:
```
--dart-define=MIRA_FACE_ANALYSIS_MOTION_V1=true
--dart-define=MIRA_FACE_RESULT_MIRROR_V1=true
```

**No global production enablement in 9F.**
