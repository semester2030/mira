# Phase 7B.1 — Audit Resolution Matrix

| Audit ID | Severity | Status | Evidence |
|----------|----------|--------|----------|
| C1 Stale grounded narration | Critical | **Resolved** | `conversation-planner.ts` early stale return; `assertFreshForGrounded`; response hard-stop; tests `testStaleNeverGrounded` |
| C2 Expiry validator unused | Critical | **Resolved** | `validateExpiredEvidence` on every `runAdvisorTurn`; `expiryOk` reported |
| C3 False subsystem attribution | Critical | **Resolved** | `evidence/provenance.ts` + seal throw; projector uses `unknown` for legacy outfit/styling/atelier |
| M1 Façade multi-turn | Major | **Resolved** | Session map in `BeautyAdvisorService`; facade persists |
| M2 Dual safety path | Major | **Resolved** | `forceBlocked` through Beauty Advisor |
| M3 MCE/intelligence façade coupling | Major | **Accepted residual** | Still uses MCE grounding for skin projection only (not evaluation); not redesigned |
| M4 law34Compliant hardcoded | Major | **Resolved** | Computed in `generateGroundedResponse` |
| M5 Planner consistency soft | Major | **Resolved** | `assertPlannerConsistency` |
| M6 Session memory unused | Major | **Resolved** | Bound on turn |
| M7 Soft envelope freeze | Major | **Resolved** | Deep freeze |
| M8 Incomplete Canonical projection | Major | **Accepted residual** | Capability routes remain; Canonical Face/GI/OI/Style projectors deferred (not Critical) |
| Minor retryable / golden / etc. | Minor | **Resolved** where in scope | `retryable` + determinism golden |

## Independent Re-Audit

**Pending**
