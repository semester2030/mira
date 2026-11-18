# MIRA Discover 1709 — evidence pack

## Identity

| Item | Value |
|---|---|
| App version | `1.0.0+2026111709` |
| Branch | `mira/discover-speed-multi-media` |
| Prior device build | `2026111708` @ `4267997` (user: no noticeable improvement) |
| Portal dashboard script | `partners-portal/web/js/catalog-journey.js` (canonical) |
| bags1 alias | byte-identical sync via `sync-catalog-journey-alias.sh` |
| Public publish | **No** |

## 1708 review closures (code + unit tests)

1. Write lock: strict mutex; peek does not wait; single origin writer proven in test.
2. Complete detection: trusted length only; truncated ftyp+moov rejected.
3. Audio: generation/owner recheck after mute await; `_syncVideo` will not release reattached video.
4. HttpClient: request-scoped errors; no shared `close(force)` on failure.
5. Proxy: real HTTP to local proxy; byte equality + neighbor priority.

## Performance verdict

**OPEN** — awaiting iPhone run on 1709. Do not declare fixed.

## Artifacts in this folder

- `LONG_FILES_INVENTORY.md`
- `SPLIT_PLAN.md`
- `LATENCY_STATUS.md`
- `FEATURE_MATRIX.md`
- `RESULTS.md` (this file)
- `SOURCE_IDENTITY.txt` (filled at package time)
