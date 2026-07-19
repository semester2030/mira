# AI Beauty Advisor v1.0.0 — Technical Debt Register

**Status:** Accepted at Production Freeze  
**Date:** 2026-07-19  

| ID | Debt | Severity | Accepted? | Notes |
|----|------|----------|-----------|-------|
| TD-BA-01 | In-memory session map | Medium | Yes | Lost on restart / not multi-instance |
| TD-BA-02 | Thin Canonical Face/GI/OI/Style projectors | Medium | Yes | Routes honest; projection under CR |
| TD-BA-03 | MCE façade coupling for skin projection | Low | Yes | Read/project only; no evaluation |
| TD-BA-04 | Separate MCE LLM consultation surface | Medium | Yes | Coexistence; unify under future CR |
| TD-BA-05 | Self-asserted `canonical_skin_report` on MCE skin transport | Low | Yes | Monitored; Re-Audit residual honesty note |
| TD-BA-06 | No performance benchmark suite | Low | Yes | Operational CR |

## Closed at Freeze (not debt)

- Stale grounded narration (Critical)  
- Dead expiry validation (Critical)  
- False Outfit/Styling attribution (Critical)  
- HTTP multi-turn / planner assert / Law #34 flag / session bind / deep freeze Majors  
