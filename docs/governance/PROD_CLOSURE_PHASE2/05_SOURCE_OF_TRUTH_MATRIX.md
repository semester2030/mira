# Phase 2 — Source-of-Truth Matrix

| Artifact | Classification | Source of truth | Commit policy |
|---|---|---|---|
| Dart under `lib/**` | SOURCE | reviewed Dart source | MUST_COMMIT |
| TypeScript under `mira-api/src/**` | SOURCE | reviewed TS source | MUST_COMMIT |
| Fashion catalog JSON | SOURCE | tracked JSON catalog | MUST_COMMIT |
| generated Fashion Dart projections | GENERATED_FROM_SOURCE | catalog generator + JSON | commit only when runtime imports require checked-in output |
| Prisma schema/migrations | SOURCE | `mira-api/prisma/**` | MUST_COMMIT when changed |
| Prisma client | GENERATED_REPRODUCIBLE | Prisma schema + installed package | SHOULD_NOT_COMMIT |
| Nest `dist/**` | BUILD_ARTIFACT | TypeScript + Nest config | SHOULD_NOT_COMMIT |
| Flutter `build/**`, `.dart_tool/**` | BUILD_ARTIFACT | pubspec + Dart/toolchain | SHOULD_NOT_COMMIT |
| Flutter plugin registrants | GENERATED_FROM_SOURCE | pubspec/platform tooling | keep only files already managed by Flutter/Git |
| CocoaPods installation output | GENERATED_REPRODUCIBLE | Podfile/lock + tooling | do not add ignored output |
| golden baselines under `test/**/goldens` | TEST_REQUIRED | reviewed golden expectation | MUST_COMMIT |
| golden `failures/**` | TEMPORARY | failed test output | SHOULD_NOT_COMMIT |
| `render.yaml` | SOURCE | repository deployment Blueprint | MUST_COMMIT |
| `.env.example` / `.env.qa.example` | GOVERNANCE_ONLY | redacted variable-name template | MUST_COMMIT after review |
| `.env`, local signing config | SECRET_OR_SENSITIVE | deployment/owner secret stores | MUST_NOT_COMMIT |
| audit-site JSON | AUDIT_ONLY | verified governance/current evidence | commit only in audit package/repository chosen by owner |
| Phase 1/2 governance | GOVERNANCE_ONLY | verified source/test evidence | MUST_COMMIT |

## Generated Fashion rule

Generated Dart must never silently become a second authoring source. JSON and
the checked-in generator define the content; generated Dart is acceptable only
where the Flutter runtime imports it and clean-machine regeneration is
documented and deterministic.

## Database state

No Phase 2 schema or migration change is introduced. Production migration
execution remains a deployment-phase concern.
