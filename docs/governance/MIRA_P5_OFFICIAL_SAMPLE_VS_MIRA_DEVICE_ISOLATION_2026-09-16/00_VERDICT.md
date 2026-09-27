# 00 — VERDICT

## Case: A — Official sample accepts + captures; Mira fails to capture

Sequential device runs on fayez’s iPhone (`00008110-00191986268BA01E`), same SDK `2.5.0.000000`, MODERATE (`lightL=0.70`, no override).

| App | Probe | Accept | Photo | Analysis |
|---|---|---|---|---|
| Official sample (`app.mira.camerakit.sample`) | `CKISO-20260915A` | **canCapture=1** (83/279 logged) | **SUCCESS** 3024×4032 | N/A (sample has no Mira analysis) |
| Mira (`app.mira.beauty`) | `CKCFG-20260915C` | ready=1 only **4**/675 | **none** | **none** |

## Proven

1. Official sample **ran on device** and reached capture acceptance + took a photo.
2. `isValid=false` on **both** apps for all logged events — including sample’s successful canCapture/capture. Therefore `isValid` is not what separates sample success from Mira failure.
3. Final quality thresholds matched (Moderate 0.70/0.85).
4. Model binaries SHA256-identical between Mira vendor and sample.

## Not proven as sole root cause (still UNKNOWN mechanism)

Why Mira’s feed yields mostly `under_exposed` / unstable READY while sample reaches `normal`/`good` under sequential runs — likely related to **frame pipeline difference** (native FullRange AVCapture vs Flutter VideoRange→rebuild), but no single-variable A/B fix was applied in this task.
