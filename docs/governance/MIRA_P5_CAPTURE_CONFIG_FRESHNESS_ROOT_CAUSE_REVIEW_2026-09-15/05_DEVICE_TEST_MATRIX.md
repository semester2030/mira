# 05 — DEVICE TEST MATRIX

## Builds on device

| Probe | Install | Launch | Notes |
|---|---|---|---|
| CKCFG-20260915B | profile via `devicectl install` OK | `--console` OK | Session B quality log captured |
| CKCFG-20260915C | profile install OK (bundle `6B39E1E0-…`) | `--console` OK | isValid gate removed; no ready window (too_small) |

## Required matrix

| # | Scenario | Status |
|---|---|---|
| 1 | Three independent captures + analysis start | NOT RUN |
| 2 | One complete analysis | NOT RUN |
| 3 | Bad pose then correct | NOT RUN |
| 4 | Exit and return | NOT RUN |
| 5 | Manual shutter | NOT RUN |
| 6 | No double capture | NOT RUN |

## Partial runtime observations

- Session B: FINAL/FIRST config; frames flowing; pending=1; `valid=0` always; 7× light=normal with area/pose good still blocked by old isValid AND.
- Session C: user mostly too_small; under_exposed common; no ready=1.

## Video

None.
