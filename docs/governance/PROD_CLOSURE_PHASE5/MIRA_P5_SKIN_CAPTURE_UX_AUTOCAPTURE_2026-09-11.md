# MIRA-P5-SKIN-CAPTURE-UX-AUTOCAPTURE-2026-09-11

## Gate classification (before → after)

| Gate / reason | Before UX | After | Class |
|---|---|---|---|
| mesh_no_face / mesh_no_bounds / mesh_region_missing | hard block | hard block | CRITICAL_BLOCKER |
| mesh_low_quality / mesh_pose_unavailable | hard block | hard block | CRITICAL_BLOCKER |
| mesh_yaw / mesh_pitch / mesh_roll | hard block | hard block | CRITICAL_BLOCKER |
| face_too_far / face_too_close | hard block | hard block | CRITICAL_BLOCKER |
| camera_not_ready / mesh_not_ready | hard block | hard block | CRITICAL_BLOCKER |
| face_off_center (ENTRY ≤0.11/0.10) | hard block | hard ENTRY | CRITICAL entry / GUIDANCE exit |
| face_off_center while HOLD within +0.02 | hard flicker | soft exit hysteresis | GUIDANCE_ONLY (exit) |

**THRESHOLDS CHANGED:** NONE on analytical mesh limits (yaw/pitch/roll/scale/region/entry center).  
**UX-only:** hold window 480ms; center **exit** hysteresis +0.02 while already holding (does not loosen ENTRY; auto-fire still requires hard critical READY).

## UX state machine

`idle → aligning → holdStill → ready → capturing → captured`

- One Arabic instruction at a time (`SkinCaptureInstruction`).
- Progress ring during hold (no 3-2-1 countdown).
- Auto-capture on stable critical READY; cancel on hard fail; soft center exit band keeps hold clock only.
- Manual shutter uses same canonical READY + gesture arm.
- Duplicate guard: `_capturing` + auto queue + hold `autoFireScheduled`.

## Implementation files

- `lib/.../capture/skin_capture_ux_policy.dart`
- `lib/.../capture/skin_capture_hold_controller.dart`
- `lib/.../capture/skin_hold_progress_ring.dart`
- `lib/.../capture/skin_capture_authorize.dart` (`mayEnterAutoCapture`)
- `lib/.../widgets/face_capture_panel.dart`
- `lib/.../live_face_map/widgets/live_face_analysis_overlay.dart`
- `test/skin_analysis/skin_capture_ux_autocapture_test.dart`

## Tests / analyze

- `flutter test test/skin_analysis/skin_capture_ux_autocapture_test.dart` → PASS
- `flutter test test/skin_analysis/skin_capture_all_pass_invariant_test.dart` → PASS
- Targeted `flutter analyze` on capture UX paths → No issues found

## Physical iPhone matrix (owner)

Template for 10 natural attempts — fill during device testing. Candidate left installed.

| # | time_to_capture_s | corrections | ready_losses | recaptures | auto_ok | notes |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |
| 6 | | | | | | |
| 7 | | | | | | |
| 8 | | | | | | |
| 9 | | | | | | |
| 10 | | | | | | |

Invalid pose control (must be 0 auto captures): yaw / pitch / roll / too close / too far / missing anatomy / multi-face.

HUD OFF equivalence: rebuild without `MIRA_SKIN_CAPTURE_GATE_DEBUG` / tap debug and confirm same auto behavior.

## Face Map / icons / Phase 6

LOCKED — not modified in this task.
