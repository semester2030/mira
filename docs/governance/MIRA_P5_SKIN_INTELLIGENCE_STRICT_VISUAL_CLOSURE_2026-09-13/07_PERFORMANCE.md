# Performance evidence

- PerfectMaskSession cacheHits prevents re-decode on repeat lookup (unit-tested)
- Metric switch uses existing ephemeral masks — no new Perfect analysis
- Soft presence pass reuses same maskBytes Image.memory (gaplessPlayback)
- DUPLICATE MASK DOWNLOADS = 0 (no new download path)
- STALE MASKS = 0 (nextSelectedMaskKey contract + session lookup)
