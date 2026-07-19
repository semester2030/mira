# Phase 6D / 6D.2 — Contract Compliance Report

| Contract | Status |
|----------|--------|
| `CanonicalOutfit` `outfit-schema-v1` | Pass — unchanged |
| Deterministic `outfitId` | Pass |
| Public strip of `evidenceGraphRef` | Pass |
| No provider fields on CanonicalOutfit | Pass |
| Fashion Runtime public projection includes optional `traceId` | Pass — intentional (see Runtime Report) |
| Capability catalog 6D caps enabled | Pass |
| `recommendations` disabled | Pass |
| Platform release label `1.0.0-outfit-intelligence` | Pass — SoT `release.ts` |
| Schema pins independent of release label | Pass — see Release Pin Policy |

## Compatibility notes (6D.2)

- Consumers must bind to **schema versions**, not the platform release string.
- Capability endpoints return engine results + validated evidence graph — not CanonicalOutfit.
- `runtime.traceId` remains part of the public Fashion Runtime contract.
