# Change scope for this review package

## This task (config order + freshness + session + degree honesty)

- `ios/Runner/PerfectCameraKitChannel.swift` — single `configureKit`, FINAL/FIRST_FRAME config logs, host receive time, pending depth, sessionId on quality, degreeReliable, partial-frame drop
- `lib/.../perfect_camera_kit_gate.dart` — no post-init setLevel; freshness 350ms; stable gap reset; session isolation; nullable degree; probe CKCFG-20260915B
- `lib/.../face_capture_panel.dart` — `experimentalLightingLower: false` default
- `lib/.../new_analysis_screen.dart` — onAnalyze invoke/skip logs + import
- `test/.../perfect_camera_kit_gate_test.dart` — degree/freshness tests

## Prior task residues (still in same untracked/modified files; not re-claimed as new)

- VideoRange→FullRange expand, HUD guidance, quality mapping baseline
- Prior lightingLower=0.55 experiment (now isolated behind experimental flag, off by default)

Diffs under `changes/*.diff` are full working-tree vs HEAD (or full untracked file). They therefore include prior WIP plus this task.

## Additional this-task fix after device session B

- Remove `&& checkedResult.isValid` from READY (align with official `canCapture()`).
- Probe bumped to `CKCFG-20260915C`.
