# PROD-FINAL-1 — Runtime Entitlement Architecture

## Layers
1. **Build inclusion** — dart-defines may be true in release binary so code is present
2. **Server authority** — `ProductionEntitlementService` using `request.user.firebaseUid`

## Env
- `MIRA_FACE_EXPERIENCE_MASTER_ENABLED` (default false)
- `MIRA_FASHION_MODE_B_MASTER_ENABLED` (default false)
- `MIRA_PRODUCTION_INTERNAL_UIDS` (comma-separated Firebase UIDs; never hardcoded)

## Contract
`GET /api/v1/entitlements/runtime` (FirebaseAuthGuard)

```json
{ "faceExperienceV1": false, "fashionAdvisorModeB": false, "version": "mira-production-entitlement-v1" }
```

Fail-closed on missing auth, missing allowlist, master OFF, fetch failure, cache expiry (5m).
