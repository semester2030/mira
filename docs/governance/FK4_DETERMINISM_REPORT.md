# FK-4 — Determinism Report

- Query hash: sorted unordered inputs; same normalized query → same hash
- Snapshot/content hash: stable serialization
- Indexes: sorted rule ids
- Lookup iteration: sorted by ruleId
- Explicit clock for trend validity
Tests: ok determinism
