# MIRA-P5-METRIC-CAROUSEL-AVAILABILITY-FIX-2026-09-13

## STATUS: PASS (engineering) — OWNER VISUAL APPROVAL PENDING

## ROOT CAUSE
Carousel membership required `session.lookup(...).bytes` non-empty (and returned `[]` when session null). That conflated **metric availability** with **mask materialization**.

## OLD ELIGIBILITY
```
map concerns ∪ providersWithMaskBytes()
THEN filter: lookup(c).bytes != empty
IF session == null → []
```

## NEW ELIGIBILITY
```
map concerns (VisibilityPolicy)
∪ PerfectMaskSession.providersPresent()  // payload presence, not bytes
ordered by existing _carouselIds
dedupe by Perfect provider
NO bytes filter on visibility
```

## METRIC AVAILABILITY SOURCE
Canonical Perfect result: `ResultMapVM.concerns` + `PerfectMaskSession.providersPresent()`.

## RENDERING (unchanged contract)
Tap → `lookup` → if bytes ready: PerfectMaskOverlay; else metric-level unavailable copy.
No new Perfect analysis. No landmark fallback. Apple Matte untouched.

## Changed files
- `lib/features/results_experience/presentation/widgets/results_skin_map_panel.dart` — remove bytes visibility gate; union via `providersPresent`
- `lib/features/results_experience/domain/perfect_mask_session.dart` — add `providersPresent()`
- `test/results_experience/perfect_mask_face_explorer_polish_test.dart` — presence vs bytes test

## NOT modified
Apple Matte, black BG, Perfect API/parser/geometry, presentation profiles, capture, Face Explorer layout, Design System.

## Duplication
NEW SERVICES/MODELS/STATE OWNERS/RENDERERS/CAROUSELS = 0
ACTIVE DUPLICATE RESPONSIBILITIES = 0

## Tests / analyze
No issues found; polish + session tests passed.

## Physical iPhone
Profile build installed + launched. Owner confirms METRIC COUNT > 0 after Skin analysis.
