# Cache prefix/full lock wait — investigation 1711

## Hypothesis (code reading)

1. `ensurePlayablePrefix` takes `_withWriteLock` then runs `_ensurePrefix`.
2. Concurrent `ensureLocal` registers `_inflight` **before** awaiting the same lock.
3. `_ensurePrefix` (holding the lock) saw `_inflight` and waited up to **12s** for `.part` growth.
4. Full download cannot grow `.part` until it acquires the lock → mutual wait until deadline.

## Reproduction (deterministic gates)

Test: `prefix holding lock + ensureLocal inflight: join-under-lock stalls ~12s (bug repro)`  
Toggle: `debugJoinInflightUnderLock = true` (restores the old join path).

Sequence:
- `debugYieldBeforeInflightJoin` fires under lock → complete `prefixInLock`
- start `ensureLocal` → assert `debugHasInflight`
- release yield → prefix enters join-wait
- Measured stall **>10s** (near 12s deadline), then Range fill after timeout

Raw: `raw/deadlock_repro_and_fix.txt`

## Fix

Default path (`debugJoinInflightUnderLock = false`): **do not join `_inflight` while holding the write lock**.  
Prefix grows via its own Range GET; waiting `ensureLocal` resumes from saved bytes when it acquires the lock.

Test: `… Range fill without join (fixed)` — same gates, completes **<3s**, Range GET observed.

Reverse order: `ensureLocal` first (holds lock); `ensurePlayablePrefix` waits **outside** lock for `.part` growth — still fast.

## Device

Whether this path fires on Fayez’s phone is **not yet measured**. Logs to watch:
`MIRA_DISCOVER_CACHE` with long `elapsedMs` under `lock=true` while another job is inflight.

## Not claimed

Fixing this deadlock ≠ proving Discover video feels fast on device.
