# hd_pore tap → visible pixel trace

| Stage | Result | Evidence |
|---|---|---|
| USER TAP المسام | PASS (UI) | carousel + selected state owner-confirmed |
| selectedMetric → pores | PASS | `_selectConcern` / carousel ids |
| canonical → hd_pore | PASS | `PerfectMaskSession.providerTypeForConsumerMetric` |
| mask reference / session lookup | DEVICE HUD | `art=` / `NO_ARTIFACT` on DIAG HUD |
| materialization state | DEVICE HUD | `READY` / `EMPTY_BYTES` / `NO_SESSION` |
| bytes length | DEVICE HUD | `bytes=<n>` |
| decode | DEVICE HUD | `rawA` / `pres` (-1 = decode fail) |
| PerfectMaskOverlay input | ENGINEERING PASS when READY | `maskBytes` gated by `unavailable` |
| paint/composite | ENGINEERING PASS when diagnostic | magenta `srcIn` + opacity 1.0 |
| LAYER above Apple matte | PASS | Stack order L1→L2→L3→L4 |
| VISIBLE PIXELS ON IPHONE | **PENDING_OWNER** | must see magenta / analysis on face |

## Expected DIAG HUD after tap المسام (when bytes present)
```
DIAG pores→hd_pore
READY bytes=<n>
rawA=<samples> pres=<samples>
dims=1200x1680
L3>L2 opacity=1.0
```
Plus hot-magenta mask over the Apple-matted face.

## If HUD shows EMPTY_BYTES / NO_ARTIFACT
Breakpoint = **MATERIALIZATION** (not layer order). Stop and fix session/bytes path only.
Do NOT retune presentation.
