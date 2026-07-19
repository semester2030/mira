# Phase 6C.1 — Audit Resolution Matrix

| Audit ID | Severity | Finding | Status | Evidence |
|----------|----------|---------|--------|----------|
| C1 | Critical | Nondeterministic garmentId | **Resolved** | `garment-identity.ts`, golden identity pin test |
| C2 | Critical | CanonicalGarment not sole public model | **Resolved** | `fashion-analysis.port.ts`, `ai-gateway.controller.ts` |
| C3 | Critical | Adapter silent failure | **Resolved** | `vision-fashion.adapter.ts`, `assertNonEmptyOnProceed` |
| M1 | Major | geometryRef unused | **Resolved** | `pickGeometryRef` + mapping tests |
| M2 | Major | Index-only pairing | **Resolved** | `pairObservations` type/category match |
| M3 | Major | fusion.fieldConfidence unused | **Resolved** | `confidence-engine.ts` |
| M4 | Major | Alias duplication | **Resolved** | `fashion-aliases.ts` shared SSOT |
| M5 | Major | Hardcoded catalog categories | **Resolved** | `catalogOwnedCategoryIds()` |
| M6 | Major | Provider strings on ResultMeta / HTTP | **Resolved** | `provider: 'mira'`; HTTP omits provider |
| M7 | Major | Incomplete leakage ban | **Resolved** | Expanded `assertNoFashionProviderLeakage` |
| M8 | Major | Ports↔GI↔Vision coupling | **Accepted residual** | Redesign out of scope |
| M9 | Major | Fragile catalog color match | **Resolved** | Stem-normalized colors |
| M10 | Major | Missing determinism/adapter tests | **Resolved** | phase6c remediation tests |
| — | Major* | Ambiguous catalog season attach | **Resolved** | No piece id on ambiguous |
| — | Minor | Batch PARTIAL threshold | Deferred | Not production-correctness blocker |
| — | Minor | Catalog re-read I/O | Deferred | Perf only |

\* Called out in audit Attribute / Risk sections; treated as production correctness.
