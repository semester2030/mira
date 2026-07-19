# Beauty Integration Readiness v0.2.0

**Phase:** 5B.1  
**Status:** Integration Ready · Provider Execution Disabled  
**Package:** `mira-api/src/beauty-experience/integration/`

## Contract

Flutter and clients consume:

- Capabilities (catalog IDs)
- Sessions / Looks / Attempts
- History / Favorites / Collections / Compare
- Canonical Try-On DTO with `runtime` + `resultAssetUrl`

They never consume:

- Provider IDs on the wire
- Vendor SDK payloads
- Fabricated try-on assets

## Activation = configuration

See Provider Readiness (5B.0) + feature flags in `feature-flags.ts`.
Live execution remains blocked until license verification and activation hooks fire with a real adapter — out of scope for 5B.1.
