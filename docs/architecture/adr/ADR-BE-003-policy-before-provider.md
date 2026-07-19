# ADR-BE-003: Policy before provider

## Decision

Capability Policy Engine must run before Provider Manager. Failures return `BLOCKED_BY_POLICY` without vendor calls.

## Consequences

Protects credits, licenses, consent, and quality gates.
