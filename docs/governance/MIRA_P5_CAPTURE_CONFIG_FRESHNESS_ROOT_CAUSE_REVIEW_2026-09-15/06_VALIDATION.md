# 06 — VALIDATION

## Commands executed (results)

```
dart analyze …perfect_camera_kit_gate.dart …new_analysis_screen.dart
→ No issues found!

flutter test test/features/skin_analysis/perfect_camera_kit_gate_test.dart
→ All tests passed! (+3)

flutter build ios --profile --no-pub
→ ✓ Built build/ios/iphoneos/Runner.app (CKCFG-20260915B then C)

xcrun devicectl device install app --device 00008110-00191986268BA01E Runner.app
→ App installed (profile)

xcrun devicectl device process launch … --console app.mira.beauty
→ Launched; Mira FINAL_CONFIG / quality lines captured
```

## Failed / aborted deploy paths

- Competing `flutter run` sessions caused VM Service hang — killed.
- `flutter install` hung on uninstall — aborted.
- Debug `flutter run` VM discovery hang — worked around via profile+console.

## Freshness / session / degree (code)

Implemented in Dart gate; unit-tested constants/degree mapping. Device did not exercise READY→stale→reset cycle because READY never latched in session C.
