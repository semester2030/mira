# Runtime Entitlement Authenticated Acceptance

With two valid controlled Firebase ID tokens:

- HTTP: 200
- keys: `faceExperienceV1`, `fashionAdvisorModeB`, `version`
- version: `mira-production-entitlement-v1`
- extra/private fields: 0
- Face capability: false
- Fashion capability: false

The authenticated application boundary and payload contract are therefore
proven. Both identities correctly received the current fail-closed state.

This is a positive authenticated-path result, but not a positive owner
entitlement result. Production has no non-empty internal UID allowlist and both
runtime masters are absent/default OFF.

`RUNTIME_ENTITLEMENT_AUTHENTICATED_PATH = PROVEN`
