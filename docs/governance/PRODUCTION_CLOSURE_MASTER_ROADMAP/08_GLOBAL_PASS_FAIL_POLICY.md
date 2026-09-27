# Global PASS / FAIL Policy

## Proof ladder

`CODE → WIRED → TESTED → COMMITTED → REPRODUCIBLE → CONFIGURED → ACCOUNT →
REACHABLE → REAL RESPONSE → DEPLOYED → DEVICE E2E → RELEASE ARTIFACT →
OPERATIONS READY → GO-LIVE`

Every subsystem stops at its actual evidence level. A lower rung never implies
a higher rung.

## Status meanings

- COMPLETE: phase evidence passed and owner accepted it.
- CURRENT: authorized next planning gate, not completed.
- PENDING: predecessor PASS missing.
- PARTIAL: meaningful evidence exists but acceptance conditions are incomplete.
- BLOCKED: a mandatory condition failed or requires unresolved external action.

## Global policy

PASS requires every mandatory condition and evidence artifact for that phase.
UNKNOWN launch-critical state is not PASS. Failure may not be hidden by mock,
fallback or successful-looking AI output. Final Phase 7 allows only GO or
NO-GO. No calendar estimates are asserted; complexity uses LOW, MEDIUM, HIGH
or EXTERNAL DEPENDENCY.
