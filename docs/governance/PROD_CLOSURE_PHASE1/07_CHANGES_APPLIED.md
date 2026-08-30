# Phase 1 — Changes Applied

## Fashion contract

- Added a strict Flutter projection of `CanonicalGarment`.
- Replaced HTTP consumption of `fashionVision` with `garments` and canonical
  `meta.analysisGate/confidence`.
- Added a bounded canonical-garment-to-engine adapter.
- Kept internal `FashionVisionDocument` out of the HTTP response contract.
- Updated service tests and removed false-green legacy wire mocks.

## Fashion runtime closure

- Canonical capture entry is `/api/v1/ai/vision/outfit/analyze`.
- Legacy mock analysis remains rejected in production.
- Offline/local repository analysis no longer returns synthetic legacy success.
- Server OI and Fashion Knowledge remain explicitly not wired/disabled.
- No Claim Lock, GI, OI, FK, or Advisor frozen semantics changed.

## Face activation

- Adopted and documented `Experience OFF / Processing allowed`.
- Added a truth-table/boundary regression suite.
- No Face/Skin processing engine or persistence behavior changed.

## Commerce security

- Public unsigned subscription webhook now fails closed and does not echo input.
- Production startup rejects `AUTH_SKIP=true` and
  `PARTNER_AUTO_APPROVE=true`.
- Dev premium activation rejects production before database/user mutation.
- Public partner status no longer exposes `accessToken`; the status UI no
  longer renders or stores it.
- Existing owner-scoped partner CRUD was preserved.

## Explicitly not changed

- Render, environment values, production secrets, deployment, database schema,
  provider accounts, mobile publishing, and frozen intelligence algorithms.
