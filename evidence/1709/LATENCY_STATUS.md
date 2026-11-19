# Latency status — build 2026111709

## Device baseline (user, build 2026111708 @ 4267997)

User reported **no noticeable improvement** on play, navigate, and return-to-clip. Performance remains **OPEN**. Unit/integration green does not close it.

## What 1709 proves in code (not on-device yet)

| Item | Evidence | Confidence |
|---|---|---|
| Write lock re-entry bug (depth allowed second writer while holder awaited) | Removed depth re-entry; test `write lock serializes writers; peekComplete reads without waiting` | High (unit) |
| ftyp+moov sniff promoting truncated complete | Complete only via trusted length; test with early ftyp+moov truncated MP4 | High (unit) |
| Stale mute releasing/muting reattached A | cut rechecks gen/owner after wait; `_syncVideo` rechecks playable+gen; test A→image→A | High (unit) |
| Shared HttpClient closed on one failure | `_openGet` / HEAD no longer `close(force)` shared client; isolation test | High (unit) |
| Proxy tests hit real proxy bytes + priority | Existing + new proxy byte/priority tests | High (unit) |

## Not proven on device (must stay open)

- Cold open → first **visible** motion (position progress ≠ pixels painted).
- Prepared / complete-cache / partial-cache deltas.
- Return after 20 distinct offers.
- Horizontal video↔image + rapid reverse swipe.
- Network/server RTT vs player init vs lock wait split on **iPhone**.

## Correlation keys for your screen recording + Xcode/console

Look for:

- `MIRA_DISCOVER_FF session=… transition=… build=2026111709 mediaId=… playerId=… firstFrameMs=… cacheSource=…`
- `MIRA_DISCOVER_CACHE mediaId=… source=… elapsedMs=… lock=…`
- `MIRA_DISCOVER_AUDIO cut_stale_after_wait` / `cut_skipped`

Pair `session` + `transition` + `mediaId` + `offer` across cache and player lines. Do **not** treat `firstFrameMs` alone as painted-frame proof.

## Hypotheses still live for device lag

1. Origin/CDN cold GET still dominates cold path (code cannot hide multi‑10 MB).
2. Decoder init / AVPlayer warm miss after many clips.
3. UI jank on PageView rebuild unrelated to cache.
4. Test API / media host mismatch vs what portal published.

Confidence until your next device run: **unresolved**.
