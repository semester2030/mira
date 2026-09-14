# PROD-FINAL-1 — Changeset Review (STOP FOR OWNER)

**STOP — do not commit until you reply APPROVE COMMIT (or request edits).**

## Proposed production release paths

### Modified (tracked)
- `lib/core/config/mira_features.dart`
- `lib/core/navigation/*` (routes/args/report navigation)
- `lib/core/network/mira_api_endpoints.dart` (+ entitlementsRuntime)
- `lib/features/advisor/**` (Face/Fashion wiring + runtime AND)
- `lib/features/dashboard/.../new_analysis_screen.dart`
- `lib/features/skin_analysis/.../face_capture_panel.dart`
- `lib/features/auth/.../auth_repository_impl.dart` (clear entitlements)
- `lib/features/profile/**` (logout clear)
- `lib/main.dart`
- `mira-api/src/advisor/**`
- `mira-api/src/ai/ai-gateway.controller.ts`
- `mira-api/src/consultation/services/consultation-orchestrator.service.ts`
- `mira-api/package.json`, `nest-cli.json`, `.gitignore`
- `render.yaml` (masters OFF + allowlist sync:false)
- Fashion schema-tests ctor fixes (build blocker)

### Untracked (must include for release)
- `lib/features/face_analysis_experience/`
- `lib/features/results_experience/`
- `lib/core/entitlements/`
- `mira-api/src/fashion-knowledge/`
- `mira-api/src/beauty-advisor/evidence/**`
- `mira-api/src/production-entitlements/`
- `test/face_analysis_experience/`
- Advisor Face/Fashion context entities/mappers/services
- `mira-api/.env.qa.example` (no secrets; optional)

### Exclude
- `.env`, `.env.qa`, secrets, logs, images, device IDs, build artifacts
- Massive unrelated governance docs unless you want them in a separate docs commit

## Suggested branch after approval
`release/mira-production-face-fashion-v1` from current work (or `main` after merge policy).

## Suggested commit message
```
release: Face Experience + Fashion Knowledge v1.0.0 with owner-canary entitlements

Include frozen Face/Fashion sources and production entitlement kill switches.
Masters remain OFF; no global activation.
```
