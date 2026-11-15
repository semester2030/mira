# CLOSURE_NUMERIC — post 2b8f702 / 46d8d08 / 26c9263

## Three delivery numbers (complete 45-count budget)

Primary run: **v10** (`46d8d08`, MiraRC2 simulator, screen-recorded)

| Metric | Value |
|---|---:|
| Transitions opened within 700ms | **13 / 45** |
| Transitions ended in timeout | **32** |
| Black-screen appearances (instrumented + cover held) | **0** |

- Cold open (first open): **8965 ms**
- Median / P95 among first_frame successes: **113 / 222 ms**
- Cover held on every timeout: **32 / 32**
- Screen proof: `SWIPE_BLACKSCREEN_PROOF_v10_90s.mp4`, `SWIPE_BLACKSCREEN_PROOF_v11_120s.mp4`

## v11 follow-up (`26c9263` reject dead warms)

| Metric | Value |
|---|---:|
| Counted | 26 (budget incomplete) |
| under700 | 6 |
| timeouts | 18 |
| blackSuspected | 0 |
| warmHits / coldHits | 6 / 19 |

## Root cause still open on simulator

1080p network clips: `isPlaying=1`, `isBuffering=1`, `position=0`, `sizeW≈1080` after play.
Same media id can succeed once and timeout later. Not the 11×404 media keys.
