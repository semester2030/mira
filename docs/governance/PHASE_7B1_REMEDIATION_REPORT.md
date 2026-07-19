# Phase 7B.1 — AI Beauty Advisor Remediation Report

**Date:** 2026-07-19  
**Release:** `0.1.1-beauty-advisor-remediation`  
**Source of truth:** Independent Audit (Verdict C)  

## Objective

Resolve all Critical Findings and production-correctness Major Findings. No architecture redesign. No frozen subsystem changes.

## Critical resolutions

| ID | Finding | Resolution |
|----|---------|------------|
| C1 | Stale evidence narrated as grounded | Planner returns `clarify` + `expired_evidence` with **zero** selected claims when `freshness.stale`; response engine hard-stops stale grounded narration; `assertFreshForGrounded` on turn path |
| C2 | `validateExpiredEvidence` dead | Runs on every turn before/with grounded gate; `expiryOk` in validation result |
| C3 | False subsystem attribution | Provenance gate on seal; MCE outfit/atelier/goals → `unknown` + `mce_legacy_summary`; frozen ids require frozen provenance tags |

## Major resolutions

| Finding | Resolution |
|---------|------------|
| HTTP multi-turn | `BeautyAdvisorService` in-memory session map; façade `persistSession: true` |
| Dual guard path | Guard sets `forceBlocked`; all replies through envelope pipeline |
| Planner consistency | `assertPlannerConsistency` throws on turn |
| Law #34 flag | Computed from citations; `assertLaw34` requires `law34Compliant` |
| Session memory | `bindSessionEvidenceRef` on sourceRefs + evidenceIds |
| Envelope immutability | Deep `Object.freeze` on claims/arrays/freshness/trace |
| Runtime retryable | Added `retryable` on `AdvisorRuntime` |
| Determinism | Sorted claimKeys duplicate resolution; golden equality test |

## Tests

`npm run test:phase7b` — PASS (incl. stale, provenance, façade multi-turn, determinism)  
`npm run test:phase6e` — PASS (frozen Styling untouched)

## Next

Independent Re-Audit. **Do not Production Freeze until Re-Audit passes.**
