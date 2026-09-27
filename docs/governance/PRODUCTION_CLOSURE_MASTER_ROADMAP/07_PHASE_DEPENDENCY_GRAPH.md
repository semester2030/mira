# Phase Dependency Graph

```text
PHASE 3C FINAL — external services ready
        ↓ owner-reviewed PASS only
PHASE 4 — exact candidate deployed
        ↓ owner-reviewed PASS only
PHASE 5 — real production E2E proven
        ↓ owner-reviewed PASS only
PHASE 6 — release/security/operations closed
        ↓ owner-reviewed PASS only
PHASE 7 — final GO / NO-GO
```

Rules:

- exactly five remaining phases;
- no phase may be skipped or run in parallel with an unmet predecessor;
- PARTIAL/BLOCKED never unlocks the next phase;
- packaging does not imply approval;
- Cursor stops after each phase and waits for explicit owner authorization;
- a blocker discovered later returns to its owning earlier phase.
