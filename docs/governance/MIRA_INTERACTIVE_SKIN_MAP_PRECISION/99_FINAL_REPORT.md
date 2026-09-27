# MIRA — INTERACTIVE SKIN MAP FINAL REPORT

**Date:** 2026-09-11  
**Deployment:** NONE  
**Store submission:** NONE

---

## 1. Root Cause

Previous map felt decorative because Perfect Corp returns **global scores only**, while the UI presented region exploration without a clear **نتيجة عامة للوجه** contract. Outlines were thin; metric switching did not change educational zone sets or accent language; detail sheets used a dark barrier that hid context.

## 2. Actual Analysis Contract

| Metric | Class |
|--------|-------|
| الدهون (`oiliness`) | **E — GLOBAL SCORE ONLY** |
| الترطيب (`moisture`) | **E — GLOBAL SCORE ONLY** |
| المسام (`pore`) | **E — GLOBAL SCORE ONLY** |

No production masks, polygons, or per-region metric scores from the analysis engine.

## 3. Geometry Architecture

Unchanged canonical path (already locked):

- MediaPipe landmarks → `LandmarkAlignedFaceGeometry` polygons  
- HIT paths = linear anatomical (`hitPaths`)  
- VISUAL paths = `SkinFaceMapVisualPathBuilder` (smooth, clipped)  
- Display mapping via `LandmarkFaceRegionSession` + face viewport  

Educational zone IDs reuse the same geometry keys (`forehead`, `nose`, `chin`, `cheeks_*`).

## 4. Metric Visualizations

| Metric | Accent | Educational zones (illustrative) | Polarity |
|--------|--------|----------------------------------|----------|
| الدهون | `AppColors.gold` | forehead, nose, chin | higher = more oil concern (global) |
| الترطيب | `AppColors.info` | cheeks L/R | higher = better hydration (global) |
| المسام | `AppColors.success` (violet) | forehead, nose, chin | higher = more pore concern (global) |

Selected region: ~5.2px edge, 22–34% fill from **global** score only. Hints: lighter fill/edge. Banner + legend state **نتيجة عامة للوجه**.

## 5. Region Interaction

- Tap face → `hitPaths` hit-test → selects region + opens sheet  
- Region chips filtered to educational set for active metric; selection syncs with overlay  
- Bidirectional: image ↔️ chips ↔️ sheet content ↔️ metric accents  

## 6. Details UX

Bottom sheet with `barrierColor` alpha **0.18** (not full-face dark mask). Explicit copy:

- «نتيجة عامة للوجه · ليست قياساً موضعياً»  
- `GLOBAL_SCORE_ONLY` truth label  

## 7. Files Created / Modified

**Modified**

- `lib/.../geometry/skin_face_map_visual_tokens.dart` (v2-truthful)  
- `lib/.../widgets/results_skin_map_panel.dart`  
- `test/results_experience/skin_face_map_premium_visual_test.dart`

**Created**

- `test/results_experience/skin_face_map_truthful_contract_test.dart`  
- `docs/governance/MIRA_INTERACTIVE_SKIN_MAP_PRECISION/00_DATA_CONTRACT_AUDIT.md`  
- this report  

## 8. Before / After

| Before | After |
|--------|-------|
| Generic outlines; unclear global vs local | Explicit GLOBAL_SCORE_ONLY banner + polarity |
| Same zones for all metrics | Metric-specific educational zone sets |
| Thin/faint selection | Stronger selected edge/fill + metric accent |
| Darker detail barrier | Light barrier; face context preserved |
| Risk of reading map as measured heat | إرشادي labeling everywhere |

## 9. Tests

| Suite | Result |
|-------|--------|
| `skin_face_map_truthful_contract_test.dart` | **6/6 PASS** |
| `skin_face_map_premium_visual_test.dart` | **12/12 PASS** |
| `skin_face_map_landmark_precision_test.dart` | **12/12 PASS** |

**Total focused: 30/30 PASS**

## 10. Analyzer

Scoped `dart analyze` on changed sources + tests:

- Errors: **0**
- Warnings: **0**
- Infos: **0**
- Output: `No issues found!`

## 11. Performance

- Paths still built in session load, not every paint frame
- `shouldRepaint` gated on concern/region/score/paths
- No continuous animation; selection transition ~200ms tokens

## 12. Truthfulness

**Proven spatially:** anatomical region outlines + hit-testing from client landmarks.

**Not proven:** oil/hydration/pore localization inside those regions. Educational fills are heuristics only.

## 13. Remaining P0 / P1

| ID | Item | Priority |
|----|------|----------|
| P0 | Provider `region_scores` / masks required for Verdict A | P0 (external) |
| P1 | Owner visual approval on device for thicker outlines + accents | P1 |
| P1 | Optional compact severity legend strip (منخفض/متوسط/مرتفع) polish | P1 |

## 14. Final Verdict

### **B — UI IMPROVED, SPATIAL DATA LIMITATION REMAINS**

Cannot award **A**: engine has no spatial contract for الدهون / الترطيب / المسام.  
Cannot award **C**: UI honesty + geometry + tests are closed within the proven contract.

---

## Package

- `/Users/fayez/Desktop/MIRA_INTERACTIVE_SKIN_MAP_PRECISION_FINAL.zip`
- SHA256: see sidecar `MIRA_INTERACTIVE_SKIN_MAP_PRECISION_FINAL.zip.sha256` (computed after ZIP freeze)
