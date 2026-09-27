# Runtime Security Acceptance

Bounded checks passed for:

- missing/invalid authentication: 401
- valid Firebase authentication: accepted
- non-allowlisted server entitlement: both capabilities OFF
- Admin endpoint without key: 401
- debug, metrics, and Swagger probes: 404
- malformed protected requests: safe 400
- stack traces in tested responses: none
- secret-pattern matches in service logs: 0
- broad feature activation: none

## P4B-BLOCKER-01 — Firebase account deletion false success

- Severity: CRITICAL
- Path: `DELETE /api/v1/users/me`
- Reproduction: temporary account → MIRA returned 204 → normal Firebase login
  still returned 200
- Runtime log: one `Firebase deleteUser failed` warning
- Root evidence: configured Admin credential path did not exist
- Impact: user can be told deletion succeeded while Firebase identity remains
- Affected subsystem: UsersService / Firebase Admin credential runtime
- Rollback required: NO; previous deploy contains the same path and production
  remains authenticated/dark-gated
- Smallest remediation: restore valid Admin credentials and make account
  deletion fail closed/transactionally report Firebase deletion failure

`CRITICAL_RUNTIME_SECURITY_BLOCKERS = 1`

No remediation was made.
