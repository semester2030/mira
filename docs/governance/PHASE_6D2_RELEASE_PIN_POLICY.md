# Phase 6D.2 — Release Pin Policy

**Decision date:** 2026-07-19  
**Phase:** 6D.2 Outfit Intelligence Release Readiness  

## Decision

**Official source of truth:** `mira-api/src/fashion-intelligence/release.ts` → `FASHION_INTELLIGENCE_RELEASE`

Regression suites (6B / 6C / 6D) **must sync** to the current platform release label when it advances.

They must **not** treat a historical phase string (e.g. `0.3.0-outfit-intelligence`) as permanently frozen.

## Rationale

| Concern | Policy |
|---------|--------|
| Platform release label | Advances with Fashion Intelligence phases (6B → 6C → 6D → 6D.1 → 6D.2) |
| Schema / contract pins | Frozen separately (`wardrobe-schema-v1`, `garment-schema-v1`, `outfit-schema-v1`, `fashion-session-v1`, `fashion-runtime-v1`, …) |
| Wardrobe / GI frozen code | Untouched by release-label bumps |
| 6B regression failure after 6D.1 | Caused by outdated **test expectation**, not Wardrobe breakage |

Reverting `FASHION_INTELLIGENCE_RELEASE` to `0.3.0` would erase remediation/release-readiness identity and is **rejected**.

Blindly changing tests without a policy would hide future pin drift — **rejected**. Correct approach: declare SoT, document it, sync goldens.

## Current pin (6D.2)

```
FASHION_INTELLIGENCE_RELEASE = '1.0.0-outfit-intelligence'
```

This is the Outfit Intelligence Production Freeze candidate label (v1.0.0 family). Schema versions remain `*-schema-v1`.

## Compatibility note

Consumers must key contracts on **schema versions**, not on the platform release label string. The release label is operational/governance metadata.
