# PHASE 8B — Implementation Report

## Package path
`lib/features/results_experience/` (Flutter feature package; presentation-only)

## Components
| Area | Path |
|------|------|
| Contracts / VMs | `contracts/` |
| Score semantics | `semantics/score_semantics_contract.dart` |
| Visibility | `visibility/visibility_policy.dart` |
| Advice ownership | `visibility/advice_ownership_policy.dart` |
| Localization / language | `localization/` |
| Projection | `projection/result_experience_projector.dart` |
| Adapter (read-only) | `projection/mira_beauty_report_projection_adapter.dart` |
| Validation | `validation/result_experience_validators.dart` |
| Flag | `flags/mira_results_experience_flag.dart` |
| Versions | `versioning/results_experience_versions.dart` |
| Laws 35/36 | `laws/engineering_laws_35_36.dart` |
| Barrel | `results_experience.dart` |
| Tests | `test/results_experience/phase8b_results_projection_test.dart` |

## Data flow
Frozen snapshot (`ResultProjectionInput` via adapter) → `ResultExperienceProjector` → `ResultExperience` → validators

## UI
Unchanged. Legacy report remains default.
