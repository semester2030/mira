# FK-13 — Independent Production Re-Audit Report

## Scope
READ ONLY. Evidence from repository code, Nest modules, production wiring, and tests re-executed during this audit.

## Release under audit
`0.9.1-fashion-knowledge-production-wiring-remediation` (runtime pin in `versioning/release.ts`).

## Method
1. Static call-graph / import search for bridge, quarantine, OI boundary, consent, exports.
2. Nest DI inspection (`AdvisorModule` providers).
3. Live probe of `resolveFashionEvidenceForAdvisorChat` without Nest provider.
4. Full independent regression rerun.
5. Documentation truth vs code (FK-12 claims not accepted at face value).

## Headline findings
| ID | Severity | Finding |
|----|----------|---------|
| F13-01 | MAJOR (activation) | No Nest provider for `FashionKnowledgeLlmPort`; Mode B not production-activatable |
| F13-02 | MINOR | `test:fk12` is SERVICE INTEGRATION (`new AdvisorService(...)`), not Nest HTTP+Firebase |
| F13-03 | MINOR | Deep imports can still reach mock/storage; barrel convention only |
| F13-04 | MINOR | Asset JSON still mentions historical `0.9.0` (non-runtime) |
| F13-05 | MAJOR (product boundary) | `RecommendationsService` remains a non-FKL legacy recommendation surface |
| F13-06 | MINOR | Platform consent service absent → CONSENT_UNAVAILABLE (fail-closed; activation dep) |

No CRITICAL Claim Lock bypass, auto-promotion, or unrestricted MCE under default/safe flags found on Advisor/consultation paths.
