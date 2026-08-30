# FK-11 — Independent Regression Report

Re-run during this audit (not prior FK-10 report):

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
| test:fk10 | PASS |
| test:phase6b | PASS |
| test:phase6c | PASS |
| test:phase6d | PASS |
| test:phase6e | PASS |
| test:phase7b | PASS |
| nest build | PASS |

## Static
- tsc: pre-existing Jest globals errors in `garment-recolor-prompt.service.spec.ts` (outside FK)
- eslint: command not found in this environment (pre-existing tooling gap)
