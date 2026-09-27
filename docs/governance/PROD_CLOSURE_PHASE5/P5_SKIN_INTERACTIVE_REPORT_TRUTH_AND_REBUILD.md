# PHASE 5 — SKIN INTERACTIVE REPORT TRUTH AND REBUILD

**Task:** `MIRA-P5-SKIN-INTERACTIVE-REPORT-2026-09-09`  
**HEAD baseline:** `248e7ccfd3a5a13001964d788c63703776c98f3f`  
**OWNER VISUAL APPROVAL:** PENDING  
**PHASE 6:** NOT STARTED

## Priority

`TRUTH > SAFETY > INTERACTIVITY > SIMPLICITY > BEAUTY`

## Skin Map truth verdict

**`LANDMARK_TEMPLATE`**

| Layer | Finding |
|-------|---------|
| Perfect Corp | Global `ui_score` concerns only — **no** masks / coordinates / region_scores in production path |
| Backend `face-map-engine` | Educational Mode B when spatial capability = none |
| Flutter geometry | `OrganicFaceGeometry` / `LuxuryFaceGeometry` — hardcoded template polygons |
| Capture MediaPipe | Guidance only — **not** result localization |

**MAP CHANGES BETWEEN FACES:** `NO` for overlay polygon topology (template). Concern **intensity** may change with global scores; geometry does not personalize per face.

**Not:** `PERSONALIZED_PIXEL_MAP` / `PERSONALIZED_REGION_MAP`.

## Truth ledger (summary)

| Claim | Class | Main UI |
|-------|-------|---------|
| Moisture / pores / wrinkles / acne / redness / age_spot / texture / oiliness | MEASURED (global) | Status labels preferred over number walls |
| Skin Vitality Index | DERIVED | Shown as vitality with truth badge |
| Skin Age / «بشرتك تبدو» / younger-by-N | DERIVED heuristic | **REMOVED from main**; optional transparency only |
| «هدفنا الوصول خلال 30 يوم» | Unsupported motivational | **REMOVED / sanitized** |
| Linear 30-day projection | DERIVED estimate | Journey only, labeled تقدير خطي — never goal |
| Skin Map zones | ILLUSTRATIVE / template | Interactive Mode B + explicit disclaimer |
| Routine AM/PM | DERIVED heuristic | Interactive plan — no fake products |
| Dark circles (when missing provider) | DERIVED/UNAVAILABLE | Not upgraded to MEASURED |

## Claims removed / reframed

- Main-surface age comparison headlines (`بشرتك تبدو`, أصغر/أكبر بـ)
- Motivational 30-day targets (`هدفنا…`)
- Invented map intensity fallback `55` when metric missing → no invented score
- Technical leaks (`provider_measured`, `raw=`, MCE) blocked on main copy
- Face geometry / Face Intelligence kept **out** of Skin consumer main scroll

## New information architecture

1. Personal summary  
2. Top trusted insights (≤3, not forced)  
3. Interactive educational map  
4. Selected concern detail (sheet)  
5. What Mira noticed  
6. What you can do  
7. Morning / evening routine  
8. Skin journey (baseline honesty)  
9. Ask Mira  
10. How Mira reached this result  

Entry: `ResultsReportEntry` → `SkinInteractiveReportScreen` when `MiraFeatures.skinInteractiveReportV1` (default **true**).

## Design System

Reuses `AppColors` / `AppTypography` / `PremiumButton` / existing results widgets.  
**No parallel Skin theme. New color tokens: 0.**

## Tests

`test/results_experience/skin_interactive_claim_policy_test.dart` — claim gate + map verdict + projection copy.

## Remaining limitations

- Map cannot become pixel-accurate without provider spatial data  
- First analysis journey is baseline only  
- Real iPhone acceptance depends on production Skin path (Perfect Corp credits/config)  
- Owner visual approval required  

## Physical iPhone

See evidence package / run log for install status.
