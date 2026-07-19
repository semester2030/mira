# Garment Intelligence — Technical Debt Register v1.0.0

**Status at freeze:** Accepted · visible · not approved for silent fix  
**Policy:** Fixes require Change Request under GI Change Policy

| ID | Debt | Impact | Disposition |
|----|------|--------|-------------|
| **TD-GI-01** | Residual Ports ↔ GI ↔ Vision package coupling (adapter imports GI; GI imports Vision schema/ontology) | Harder provider/taxonomy isolation | Accept until Fashion Knowledge / Taxonomy phase; no redesign in freeze |
| **TD-GI-02** | Flutter Outfit path still parses `fashionVision` while frozen HTTP returns CanonicalGarment | Client analyze broken until migration | Documented migration; client work outside GI freeze (do not dual-serve without MAJOR CR) |
| **TD-GI-03** | Live request `traceId` flows into embedded `CanonicalGarment.runtime.traceId` | Full HTTP body not byte-identical across requests; identity still stable | Accept (identity policy excludes wall-clock / request trace from `garmentId`) |
| **TD-GI-04** | `DetectedGarment` type still exported from port module as `@internal` | Import hygiene risk | Cleanup via PATCH/MINOR CR; must not return on wire |
| **TD-GI-05** | Shared error DTO exposes `provider` string (Mira-opaque, e.g. `mira_garment_intelligence`) | Minor metadata on error path | Accept Phase-1 port pattern; ban vendor SDK names |
| **TD-GI-06** | Attribute field confidence constants when fusion lacks matching field | Not fully fusion-evidenced for those fields | Accept; fusion fields preferred when present |
| **TD-GI-07** | Per-piece catalog JSON re-read for season/occasion evidence | Perf under multi-garment load | Optimize only with CR if outputs unchanged |
| **TD-GI-08** | Batch `PARTIAL` if `limitations.length > 3` heuristic | Magic threshold | Accept minor; change needs CR |
| **TD-GI-09** | Future Taxonomy Service / Knowledge Graph not yet SSOT | Catalog + ontology dual sources remain | Deferred to Architecture Addendum later phases |
| **TD-GI-10** | Build release string in code (`0.2.1-garment-intelligence-remediation`) vs governance freeze `1.0.0` | Dual identifiers | Governance freeze `1.0.0` aliases frozen build; code pin update only via CR (no silent retag) |

## Explicitly not debt of this freeze

- Outfit Intelligence (not started)  
- Styling / Recommendation engines  
- Provider SDK replacements  
- Face / Skin / Beauty changes  

Nothing in this register authorizes implementation without a CR.
