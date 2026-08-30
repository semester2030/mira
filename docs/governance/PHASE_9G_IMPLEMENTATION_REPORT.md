# PHASE 9G — Implementation Report

## Package
`lib/features/face_analysis_experience/presentation/result/details/`

## Core
| Component | Role |
|---|---|
| `FaceDetailSheetVm` | Sheet presentation VM |
| `FaceDetailAssembler` | Pure assembly from 9E projection |
| `FaceDetailRouter` | detailRef / insight / region / details button |
| `showFaceDetailSheet` | Modal bottom sheet host |
| `FaceDetailSheet` + sections | UI hierarchy |
| `FaceDetailAccessibilityList` | Screen-reader alternative |

## Wiring
- 9F `ResultsFaceMirrorScreen`: primary/insight/region taps + «التفاصيل» open sheets
- Selection state syncs insight + region + detailRef
- RepaintBoundary on mirror surface
- Advisor routes via existing `AdvisorRouteArgs.skin` only

## Flag decision
Details are inseparable from Result Mirror → **follow `MIRA_FACE_RESULT_MIRROR_V1`**.
No separate `MIRA_FACE_DETAIL_SHEETS_V1` (avoids broken «التفاصيل» button).
