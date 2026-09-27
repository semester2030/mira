# 03 — RESULTS

## Sample (`CKISO-20260915A`) — ~75s window

| Metric | Value |
|---|---|
| Quality log events | 279 |
| canCapture=1 | 83 |
| isValid=1 | 0 |
| Longest canCapture streak | ≥1916 ms (at capture) |
| Capture request | yes (`canCapture=1 isValid=0`) |
| Capture success | yes (`imageW=3024 imageH=4032`) |

Top combos: too_small+under_exposed (reject); **good+good+normal/good with canCapture=1**.

## Mira (`CKCFG-20260915C`) — ~90s window immediately after

| Metric | Value |
|---|---|
| Quality log events | 675 |
| ready=1 | 4 |
| isValid=1 | 0 |
| Stable READY ≥800ms | not observed |
| takePicture / AUTO fire | none |
| onAnalyze | none |

Top combos: **good+bad+under_exposed** (324); **good+good+under_exposed** (231); only 4× good+good+normal→ready=1.

## Separation

1. Frame acceptance: sample yes (83); Mira rare (4) and non-stable.
2. Actual photo: sample yes; Mira no.
3. Analysis start: Mira no (blocked before capture).
