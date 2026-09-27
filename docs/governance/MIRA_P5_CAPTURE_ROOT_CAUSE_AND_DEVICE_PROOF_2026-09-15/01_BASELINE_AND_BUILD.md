# 01 — BASELINE AND BUILD

| Field | Value |
|---|---|
| Repo path | `/Users/fayez/Desktop/mira` |
| Branch | `mira/p5-strict-frontend-recovery-2026-09-14` |
| HEAD commit | `66dd435` (committed baseline; CameraKit work is **uncommitted** WIP) |
| App version | `1.0.0+1` (`pubspec.yaml`) |
| CameraKit | `2.5.0` / `PerfectLibCameraKitVer=2.5.0.000000` |
| Flutter camera | `camera: ^0.12.0+1` |
| Device | fayez’s iPhone wireless `00008110-00191986268BA01E` iOS 26.6 |
| Prior usability ZIP | `/Users/fayez/Desktop/MIRA_P5_CAMERAKIT_CAPTURE_USABILITY_CLOSURE_2026-09-15.zip` — **2 markdown reports only** |
| Screen recording named in prompt | **NOT FOUND** on Desktop/Downloads/Movies via find/mdfind |

## How we know the tested build includes our changes

Debug `flutter run` installs the local tree. Init log must show:
`lightingOverride=…` and `lightL=0.55` (after this fix) or prior values if old build.

## Prior package note

`MIRA_P5_CAMERAKIT_CAPTURE_USABILITY_CLOSURE_2026-09-15.zip` contents:
- `00_FRAME_FEED_AND_HUD.md`
- `01_STATUS.md`

No source, no diff, no device logs inside that ZIP (VERIFIED).
