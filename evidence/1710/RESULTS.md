# MIRA 1710 results

## Verdict

| Claim | Status |
|---|---|
| Video speed fixed on device | **NOT PROVEN** — OPEN |
| Cache safety gaps (persist / HEAD / unify) | Proven in **code + unit tests** |
| All features safe | **NOT PROVEN** — most UNTESTED |
| Long-file study | Completed for video-critical set; **no extract executed** |

## Identity

See `SOURCE_IDENTITY.txt`. API live-checked: `https://mira-api-n4p3.onrender.com/api/v1/health` → 200.

## Proven in code

1. Trusted complete persisted as `{file}.mira_complete` (mediaId + total + prefix SHA-256).
2. New cache instance reopens complete file with origin down (no HEAD/GET).
3. HEAD requires 2xx + valid length; rejects HTML/JSON error lengths.
4. Complete definition unified: index / peek / prefix / proxy / download early-hit all require marker validation.
5. Write-lock chain closes check-then-set race; independent `stopAfterBytes` writers serialize.
6. Failed peer download does not abort concurrent other mediaId download.

## Proven in tests (raw logs)

- `raw/flutter_test_disk_1710c.log` — All tests passed (exit 0)
- `raw/flutter_test_port_1710c.log` — AssetVideoPort passed
- `raw/flutter_test_sync_1710b.log` / sync harness — screen-sync pattern

## Not proven on device

Cold/prepared/return-after-20/app-relaunch/video↔image/leave-Discover timings. `firstFrameMs` is position progress, **not** painted-frame proof.

## Commits

Behavior commit then docs/evidence (see git log).
