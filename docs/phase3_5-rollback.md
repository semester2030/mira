# Phase 3.5 Rollback

## What Phase 3.5 added

- `docs/contracts/*` Skin Intelligence contracts
- `docs/architecture/phase3_validation.md`
- `mira-api/src/intelligence/skin-intelligence/validation/**`
- `mira-api/src/intelligence/phase3_5-validation.schema-tests.ts`
- `npm run test:phase3.5`
- Golden snapshots under `validation/goldens/`

## What Phase 3.5 did NOT change

- SVI v2 formula (unless a proven bug — none applied)
- Capture quality / Phase 2.1
- Flutter UI redesign
- Perfect Corp integration
- Phase 4 Face Intelligence

## Rollback steps

1. Remove or ignore `test:phase3.5` and validation package.
2. Optionally delete `docs/contracts/*` and goldens (contracts are documentation-only).
3. Phase 3 runtime engines remain unchanged and safe.

## Note

Deleting goldens without removing the test will regenerate them on next run (first-write). Prefer keeping goldens committed so unexpected semantic drift fails CI.
