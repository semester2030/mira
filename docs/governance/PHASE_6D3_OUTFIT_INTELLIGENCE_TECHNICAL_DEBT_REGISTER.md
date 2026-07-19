# Outfit Intelligence v1.0.0 — Technical Debt Register

**Status:** Accepted at Production Freeze  
**Date:** 2026-07-19  
**Rule:** Do not hide debt. Dispose via CR after Freeze.

| ID | Debt | Severity | Accepted? | Notes / Future |
|----|------|----------|-----------|----------------|
| TD-OI-01 | Heuristic / rule-based confidence weights (`OUTFIT_CONFIDENCE_WEIGHTS_V1`) | Low | Yes | Calibrate under CR; keep versioned weights |
| TD-OI-02 | Climate evaluation via garment season/material proxies | Low | Yes | Not a weather model; future context provider CR |
| TD-OI-03 | Modesty `standard` via type-id coverage heuristics | Low | Yes | Future policy/taxonomy CR |
| TD-OI-04 | Mid-slot assignment via type-string list | Low | Yes | Align with richer GI/taxonomy when available |
| TD-OI-05 | Evidence edges often star-to-version outside composition | Low | Yes | Law #31 structurally satisfied; richer relations later |
| TD-OI-06 | Legacy HTTP outfit-analysis / hybrid routes outside package | Medium | Yes | Separate modernization track; not Outfit Freeze scope |
| TD-OI-07 | Future Fashion Knowledge Graph not integrated | Info | Yes | Phase after Styling / platform KG |
| TD-OI-08 | Future Taxonomy Service not integrated | Info | Yes | Must not silently redefine slot mapping |
| TD-OI-09 | Recommendation Engine capability disabled | Info | Yes | By design for Outfit ownership |
| TD-OI-10 | Capability paths do not emit CanonicalOutfit | Info | Yes | Architecture — not defect |

## Closed at Freeze (not debt)

- Release pin desync (6D.2)  
- Capability graph integrity gap (6D.2)  
- Undocumented public `traceId` (documented)  
- Critical / production Majors from Independent Audit (6D.1 + Re-Audit + 6D.2)
