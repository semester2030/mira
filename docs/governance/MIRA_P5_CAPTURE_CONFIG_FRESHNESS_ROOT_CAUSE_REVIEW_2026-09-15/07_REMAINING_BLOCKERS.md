# 07 — REMAINING BLOCKERS

1. **End-to-end device matrix** not completed (need face fill oval + lighting that yields good/good/(normal|good) after isValid fix).
2. **`isValid` always false** on Mira’s Flutter→NV12 feed — meaning unknown; no longer gates READY, but unexplained.
3. **`under_exposed` mechanism** still UNKNOWN (convert vs scene vs AE).
4. Debug `flutter run` attach unreliable on this device; use profile + `--console` for evidence.

## Single user step

Unlock iPhone, open Skin capture, fill the oval until HUD allows capture (or auto-fires). Keep USB connected — console/syslog under `/tmp/mira_ckcfg_c_console.txt` records READY / takePicture / onAnalyze automatically when conditions are met.
