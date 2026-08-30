# FK-9 — Regression Report

| Suite | Result |
|-------|--------|
| test:fk2 | PASS |
| test:fk3 | PASS |
| test:fk4 | PASS |
| test:fk5 | PASS |
| test:fk5a | PASS |
| test:fk6 | PASS |
| test:fk7 | PASS |
| test:fk8 | PASS |
| test:fk9 | PASS |
| test:phase6b | PASS |
| test:phase6c | PASS |
| test:phase6d | PASS |
| test:phase6e | PASS |
| test:phase7b | PASS |
| nest build (via test:fk9) | PASS |

## Notes
- `tsc --noEmit` reports pre-existing Jest globals errors in `garment-recolor-prompt.service.spec.ts` (outside Fashion Knowledge).
- `eslint` binary not present in this environment (`command not found`) — not introduced by FK-9.
