# 00 — VERDICT

## Status

**AWAITING_DEVICE_VERIFICATION** for end-to-end capture → analysis completion (3× matrix not completed).

## Classification (corrected, with new evidence)

| Claim | Status |
|---|---|
| Blocking condition: READY never true → shutter/auto never fires | IDENTIFIED (prior 80179 + sessions B/C) |
| Config bug: Dart `setLevel` after native overwrite resets thresholds | VERIFIED by SDK header contract + code path; **default path no longer calls post-init setLevel** |
| Final production config this build | VERIFIED on device: `CKCFG-20260915C`, MODERATE, `lightL=0.70`, `experimental=0`, `override=0` |
| Integration bug: READY ANDed `isValid` unlike official sample `canCapture()` | **VERIFIED** (sample source + device session B: 7× good/good/normal with `valid=0`, `ready=0`) |
| Why SDK returns `isValid=false` always in our feed | UNKNOWN |
| Why `under_exposed` dominates many frames | UNKNOWN (not proven frame-convert vs scene vs AE) |

## Device proof this task

| Build | Probe | Result |
|---|---|---|
| Profile install | `CKCFG-20260915B` | FINAL/FIRST config OK; 111 quality events; `valid=0` always; 7× good/good/normal still `ready=0` (old gate) |
| Profile install after gate fix | `CKCFG-20260915C` | Config OK; 560+ events mostly `too_small`+`under_exposed`; **no** good/good/(normal\|good) window in that attempt → no `ready=1` observed; no takePicture |

No success video. Capture+analysis matrix not claimed.
