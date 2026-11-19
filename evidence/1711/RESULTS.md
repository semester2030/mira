# MIRA 1711 results

## Separated claims

| Claim | Status |
|---|---|
| Prefix/full **deadlock under write lock** | **Proven in code + deterministic repro test** (~12s stall) |
| Deadlock **fixed** (no join under lock) | **Proven in unit tests** (same gates, <3s) |
| DiscoverPresentationScreen A→image→A sync | **Proven in widget test** on real screen + PageController (`fallbackToController=false` this run) |
| Video **feels faster on iPhone** | **OPEN — not measured this pass** |
| All features / multi-media portal E2E | **UNTESTED** |
| Full long-file split | **Not executed** (separate track) |

## Identity

- Build: `1.0.0+2026111711`
- Branch: `mira/discover-speed-multi-media`
- API default: `https://mira-api-n4p3.onrender.com/api/v1`
- Final tests: `raw/flutter_test_final_1711.txt` exit 0 (58 tests)

## Prior failed attempts (closed)

- 1710 screen test copied `_syncVideo` guards → replaced by real `DiscoverPresentationScreen` test.
- Early fling miss on video page → same physicalSize/setup as existing presentation tests; this run used real fling (`fallbackToController=false`).
- Deadlock Range parse errors in first repro draft → fixed test server Range parsing (not product).
