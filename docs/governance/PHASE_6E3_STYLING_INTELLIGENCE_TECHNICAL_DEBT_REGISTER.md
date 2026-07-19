# Styling Intelligence v1.0.0 — Technical Debt Register

**Status:** Accepted at Production Freeze  
**Date:** 2026-07-19  

| ID | Debt | Severity | Accepted? | Notes |
|----|------|----------|-----------|-------|
| TD-SI-01 | Soft ledger immutability (copy without `Object.freeze`) | Low | Yes | Bijection validated; harden under CR if needed |
| TD-SI-02 | Caller-owned memory persistence (`memorySnapshot`) | Low | Yes | By design for isolation; callers must persist |
| TD-SI-03 | Legacy Mira Style Report coexistence | Medium | Yes | Not Canonical Style; quarantine later |
| TD-SI-04 | Legacy Flutter FKG / ranking coexistence | Medium | Yes | Not platform FKG; separate track |
| TD-SI-05 | Internal decision ledger on service return | Low | Yes | Must not be HTTP-public; strip at gateway |
| TD-SI-06 | Formality always `unevaluated` | Low | Yes | Future preference CR |
| TD-SI-07 | No performance benchmarks in freeze suite | Low | Yes | Add under operational CR |
| TD-SI-08 | Recommendation capability disabled | Info | Yes | Law #26 — Reco phase |

## Closed at Freeze (not debt)

- Law #32 Critical (goal_draft / fallback)  
- Singleton memory  
- Service/engine trace divergence  
- Priority / progress / overall confidence / ledger bijection Majors  
