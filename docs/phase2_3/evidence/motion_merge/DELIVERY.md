# Discovery Motion merge — delivery

## Build / commit
- **Commit (worktree HEAD):** `a15f3b5` (`a15f3b53189392465babe7c4b4de399a10eb3b5f`)
- **App version / build:** `1.0.0+2026110301` (`FLUTTER_BUILD_NUMBER=2026110301`)
- **Note:** Motion + independent-lane work is **uncommitted** on branch `mira/elegance-e1-taxonomy-foundation` (dirty tree). HEAD commit message predates this motion merge.

## What changed (home only)
- `lib/features/marketplace/presentation/widgets/mira_world_orbit_discover.dart`
  - No pink orbit ring; static petal positions
  - Petal diameter ≈ `0.316 × width`; center disc ≈ `1.22 ×` petal
  - Press: +8% scale, −5.5pt lift, pink glow; open after ~135ms (skipped when `disableAnimations`)
  - Drag-cancel → no navigation; web hover/focus preview at 0.55× intensity
  - Center logo: bronze-ink fit + champagne Fill In/Out; pauses off-route / background / reduce-motion

## Verified (automated)
- `flutter analyze` on orbit widget: **No issues**
- `flutter test` `phase2_3_dashboard_taps_test.dart` + `phase2_3_orbit_and_orbs_test.dart`: **All passed** (six lanes open/pop; assets resolve)
- Captures at **320 / 390 / 430**: `AFTER_home_orbit_dashboard_*.png` vs `BEFORE_*` (same harness sizes)
- Short clip from real widget (animations on): `MOTION_logo_fill_and_orbit.mp4`

## Device
- Target: fayez’s iPhone (`00008110-00191986268BA01E`, iOS 26.6) — connected and paired.
- **Physical install blocked by Macintosh HD space** (`No space left on device` during Xcode build / CodeSign / xcresult). Freed caches repeatedly (~3Gi available) but a full Debug device build still fills the volume mid-compile.
- To see the change on the phone: free ≥8–10Gi on the Mac, then from `elegance-e1`:
  `flutter run -d 00008110-00191986268BA01E --dart-define=MIRA_MARKETPLACE_ENABLED=true --dart-define=USE_MIRA_API=true`
- Widget-level proof of motion (logo Fill In/Out) is in `MOTION_logo_fill_and_orbit.mp4` from the live `MiraWorldOrbitDiscover` under test (not preview.html).

## Desktop package
- `/Users/fayez/Desktop/MIRA_Discovery_Motion_Merge_Evidence.zip`

## Not treated as proof
- `REF_motion_preview_390.png` / ZIP `preview.html` are design references only.
