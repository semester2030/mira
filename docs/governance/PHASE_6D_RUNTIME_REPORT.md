# Phase 6D / 6D.2 — Runtime Report

Outfit emits existing Fashion Runtime via `fashionRuntime` + `toPublicFashionRuntime`.

| Aspect | Status |
|--------|--------|
| Status vocabulary unchanged | Pass |
| `providerId` stripped from public | Pass |
| Capability id on runtime | Pass |
| No runtime **schema** redesign | Pass |
| Status-aware reason codes / stages | Pass (6D.1) |
| Public `traceId` | **Intentional Pass (6D.2)** |

## Decision: public `runtime.traceId`

**Keep on public DTO.**

Rationale:

1. `CanonicalFashionRuntime.traceId` is part of the approved Fashion Runtime public projection used across Wardrobe, Garment Intelligence, and Outfit.
2. Outfit uses deterministic capability-scoped traces (`deterministicEvalTraceId` / capability constants) for correlation — not provider payload leakage.
3. Removing `traceId` from `toPublicFashionRuntime` would break the shared runtime contract (forbidden in 6D.2).

Provider ids, provider payloads, and raw evidence graphs remain non-public.
