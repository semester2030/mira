# FK-11 — Test Coverage Audit

## Strengths
fk2–fk10 schema suites cover contracts, lock, LLM caps, domains, telemetry Law #39, bridge scenarios with mocks, Law #34 seal in fk10 tests.

## Gaps (MAJOR for freeze)
- No controller/Nest integration test proving `/advisor/chat` → bridge
- No live MCE quarantine e2e against ConsultationOrchestrator beyond unit-ish flag tests
- Flag matrix incompletely tested as HTTP behavior
- Happy-path Mode B proven in tests, **mocked away from production wiring**

Tests green ≠ production path complete.
