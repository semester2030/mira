# Phase 2 + 3 independent verdicts

Date (UTC): see RUN_TIME_UTC.txt / package stamp  
Base: `mira/elegance-e1-taxonomy-foundation` above `9690bb8`  
Phase 1: `OPEN_DEFERRED_BY_OWNER` (unchanged)  
Phase 4: not started  

## Phase 2 — Partner portal orb images
**PASS_LOCAL**

- Real portal acceptance page navigated; 15 circles decoded and SHA-matched to matrix (4 roots + 11 subs).
- Negative rings↔earrings byte swap detected (`negativeFailedCorrectly=true`).
- Evidence: `PORTAL_ORB_BROWSER_RESULTS.md`, `PORTAL_ORB_NEGATIVE.json`, `PHASE2_ORB_TABLE.md`.

## Phase 3 — Home orbit + customer navigation
**PASS_LOCAL**

- `mira_center_logo.png`: full official MIRA mark + word (no أناقتك fragment).
- `elegance_home.png`: clean hanging clothes (home-orbit only).
- Dashboard placement harness: after نظرة سريعة, before نصيحة اليوم; pink ring; center ≈1.25× petal; Tajawal readable; no empty orbs on 320/390 captures.
- Six taps open `DiscoverPresentationScreen` with correct lane branches (content asserts).
- Desktop PNGs: `MIRA_HOME_EXEC_320x640.png`, `MIRA_HOME_EXEC_390x844.png`, compare `MIRA_HOME_COMPARE_ref_vs_exec_390.png`.
- Evidence: goldens + `PHASE3_TAP_TABLE.md` + `FLUTTER_TEST_FINAL.txt`.

## Commands
```bash
# Portal (from docs/phase2_3/evidence)
node verify_portal_orbs_browser.mjs

# Flutter (separate processes — soft-render hang if chained with taps)
flutter test test/features/marketplace/phase2_3_orbit_and_orbs_test.dart
flutter test test/features/marketplace/phase2_3_dashboard_taps_test.dart
# Captures (watchdog stops hung toImage after write)
flutter test test/features/marketplace/phase3_orbit_capture_only_test.dart --update-goldens
```
