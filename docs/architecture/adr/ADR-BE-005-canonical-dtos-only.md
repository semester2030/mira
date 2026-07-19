# ADR-BE-005: Canonical DTOs only on the wire

## Decision

Flutter receives canonical DTOs without provider ids or vendor JSON. Internal audit may retain providerId on attempts.

## Consequences

`assertCanonicalDtoNoProviderFields` enforced in foundation tests.
