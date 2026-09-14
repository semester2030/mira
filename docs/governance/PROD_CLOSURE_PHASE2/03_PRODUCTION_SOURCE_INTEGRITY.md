# Phase 2 — Production Source Integrity

## Finding

`SOURCE_IDENTITY_RISK = TRUE`

The current runtime/build graph depends on source that is present locally but
not represented by HEAD.

## Production-critical untracked source

| Group | Files | Tracked? | Referenced/required? | Risk if omitted |
|---|---:|---|---|---|
| `lib/features/face_analysis_experience/**` | 121 | no | yes, routes/widgets/flags | Face build failure or missing experience |
| `lib/features/results_experience/**` | 32 | no | yes, report navigation | build failure or legacy-only result path |
| `lib/core/entitlements/**` | 4 | no | yes, app startup/runtime gates | build failure; activation truth absent |
| `lib/features/advisor/**` additions | 5 | no | yes, tracked Advisor UI imports | build failure/incomplete Advisor |
| `lib/features/outfit_analysis/**` additions | 2 | no | yes, Phase 1 canonical contract | Phase 1 regression/build failure |
| `mira-api/src/fashion-knowledge/**` | 170 | no | yes, module imports and provider graph | Nest build failure/FK absent |
| `mira-api/src/production-entitlements/**` | 5 | no | yes, `AppModule` and Flutter runtime endpoint | Nest build failure/entitlements absent |
| `mira-api/src/beauty-advisor/**` additions | 3 | no | yes, Advisor evidence/context | build failure/incomplete evidence |

Total untracked production source at baseline: `342` files.

Phase 1 test sources are also untracked and required for auditable closure:

- Fashion backend contract;
- Face activation boundary;
- Commerce adversarial security;
- Flutter Fashion contract/service tests.

## Ignored-source verification

No production Dart/TypeScript/HTML source is accidentally ignored. The
source-like ignored paths resolve only to:

- `.DS_Store`;
- `mira-api/.env`;
- `ios/Flutter/Signing.xcconfig.local`;
- Python cache.

No ignore-rule change is required in Phase 2.

## Closure handling

All production-critical modified/untracked groups are explicitly assigned to
the proposed source-identity commit. Temporary failed-golden output and local
LAN tooling are explicitly excluded. Secrets and build products remain ignored.

This accounts for the source set but does not make it committed. The risk
remains true until owner-approved staging and commit produce a new immutable
Git identity.
