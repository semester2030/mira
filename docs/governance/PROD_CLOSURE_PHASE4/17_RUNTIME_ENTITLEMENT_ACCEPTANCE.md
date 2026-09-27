# Runtime Entitlement Acceptance

## TEST / RUNTIME / PRODUCTION evidence

Canonical route: `/api/v1/entitlements/runtime`

- Before deployment: 404
- After deployment without Firebase bearer token: 401
- After deployment with an invalid bearer token: 401
- Route remained 404: `NO`
- Firebase guard enforced: `YES`
- Response exposed allowlist or entitlement secrets: `NO`

The clean production-entitlement contract suite proved authenticated
resolution semantics: authenticated UID, allowlist, and both master controls
are intersected; missing config and non-allowlisted UIDs return capabilities
OFF.

This proves route existence and fail-closed semantics required by Phase 4A.
A real owner-only authenticated production entitlement E2E remains explicitly
reserved for Phase 4B.

`RUNTIME_ENTITLEMENT_ROUTE = PROVEN`
