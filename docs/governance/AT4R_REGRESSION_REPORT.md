# AT-4R — Regression Report

## Executed this session
| Suite | Result |
|-------|--------|
| `npm run test:at2` | PASS |
| `npm run test:fk12` | PASS |
| Flutter `test/advisor/` | PASS (19) |
| `npm run at4r:check` | FAIL expected (`.env.qa` missing) |

## Pending after key
- `npm run at4r:live` / `AT4_LIVE_PROVIDER=1 npm run test:at4` with proof true
- `test:fk10`, `phase7b`, `nest build`, `flutter analyze` as full gate when live unlocks

Static AT-4 suite without live opt-in remains the non-live regression baseline.
