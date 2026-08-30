# PHASE 9J — Comparability Model

`FaceComparabilityClass`:
- **STRUCTURAL** — geometry/shape; history OK; never improved/worsened
- **CHANGEABLE** — only if frozen Face output has legitimately changeable traits (none robust → no progress tracking)
- **CONTEXTUAL** — pose/light/expression/camera sensitive
- **NOT_COMPARABLE** — missing semantics/version/quality/compatible capture

`FaceComparabilityGate`: COMPARABLE | COMPARABLE_WITH_QUALIFICATION | NOT_COMPARABLE
