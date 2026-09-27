# Owner Canary Acceptance

Temporary technical identities only:

- `OWNER_CANARY`
- `NON_OWNER_CANARY`

Raw UIDs, emails, passwords, and tokens are intentionally absent.

With the Fashion master enabled and only `OWNER_CANARY` added to the preserved
allowlist:

- OWNER authenticated runtime entitlement: 200, `fashionAdvisorModeB = true`
- NON_OWNER authenticated runtime entitlement: 200,
  `fashionAdvisorModeB = false`
- repeated OWNER → NON_OWNER → OWNER sequence retained correct identity state
- cross-user privilege leak: 0
- unauthorized privilege: 0

`P4B-BLOCKER-02` (owner/allowlist positive entitlement not proven) is closed
at the authoritative runtime-entitlement boundary.

The stronger downstream Advisor protected-capability proof did not pass and is
recorded separately as `P4B-BLOCKER-03`; this prevents Phase 4 PASS.
