# 01 — BUILD AND BASELINE

| Item | Value |
|---|---|
| App | `1.0.0+1` |
| CameraKit | `2.5.0.000000` |
| Flutter `camera` | `0.12.0+1` (pubspec.lock) |
| `camera_avfoundation` | `0.10.1` → yuv420 = VideoRange biplanar |
| Build probe (session B) | `CKCFG-20260915B` |
| Build probe (post isValid fix) | `CKCFG-20260915C` |
| Device | fayez’s iPhone `00008110-00191986268BA01E` iOS 26.6 USB (`transportType: wired`) |
| Artifact | `build/ios/iphoneos/Runner.app` profile |

HEAD baseline note: CameraKit channel/gate files are WIP (untracked/modified vs git). Diffs include prior integration + this task; see `changes/00_CHANGE_SCOPE.md`.
