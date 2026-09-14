# PHASE 8E — Date and Time Behavior

Projection uses explicit `ResultProjectionContext.now`. Screen accepts `clock` for tests.
Period default: hour≥17 → evening else morning.
Completion day keyed to calendar date of clock — no rollover carry.
