# FK-9 — Performance Report

Synthetic aggregation timings from `npm run test:fk9` (local):

| Events | Aggregation |
|--------|-------------|
| 100 | ~0–1 ms |
| 1,000 | ~1 ms |
| 10,000 | ~6 ms |

Do not overclaim production scale from synthetic in-memory store.
