# PHASE 5 — SKIN INTERACTIVE VISUAL POLISH

**Task:** `MIRA-P5-SKIN-INTERACTIVE-VISUAL-POLISH-2026-09-09`  
**Mode:** Controlled surgical UX refinement + runtime defect closure  
**Date:** 2026-09-09

## Scope

Polish the **existing** Interactive Skin Report (truth model already approved).  
No architecture rewrite. No Phase 6. No go-live. No fake spatial precision.

## Map truth (preserved)

| Field | Value |
|-------|--------|
| Verdict | `LANDMARK_TEMPLATE` |
| Class | `ILLUSTRATIVE` / `SkinTruthClass.illustrative` |
| Consumer label | خريطة مناطق استرشادية |
| Pixel-accurate claim | **Forbidden** |

Soft region overlays + region chips; no invented region scores (global metric only).

## Interaction architecture

1. **Personal summary** → **Top insights** → **large interactive map** → routine / journey / Ask Mira  
2. Metric chips above map; tap updates overlay + summary  
3. Region tap → contextual bottom sheet (noticed / means / do / truth)  
4. Top Insight tap → `selectConcern` + scroll to map  
5. Routine step tap → «لماذا؟» sheet from existing `reasonAr`  
6. Transparency collapsed by default  

## Runtime defect

| Item | Detail |
|------|--------|
| Symptom | `type 'double' is not a subtype of type 'String?' in type cast` |
| Path | Advisor / Consultation JSON → `confidence` / `valueAr` as `num` → `as String?` |
| Files | `lib/core/json/json_as_string.dart`, `advisor_response.dart`, `consultation_entities.dart` |
| UX | Advisor SnackBar uses safe product copy (no raw `$e`) |
| Regression | `test/advisor/double_string_cast_regression_test.dart` |

## Tests

- `test/advisor/double_string_cast_regression_test.dart`
- `test/results_experience/skin_interactive_claim_policy_test.dart`
- `test/results_experience/skin_interactive_visual_polish_test.dart`

## Owner gate

`OWNER VISUAL APPROVAL = PENDING`  
Phase 6 = NOT STARTED
