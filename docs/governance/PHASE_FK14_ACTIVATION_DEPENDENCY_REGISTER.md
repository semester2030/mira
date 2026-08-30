# PHASE_FK14 — Fashion Knowledge Activation Dependency Register

**Principle:** Activation dependencies are **not** Technical Debt.  
They are explicit prerequisites before production feature enablement.

**Date:** 2026-08-10

| ID | Description | Severity | Owner | Prerequisite | Current safe state | Activation impact | Completion evidence | Status |
|----|-------------|----------|-------|--------------|--------------------|-------------------|---------------------|--------|
| AD-FK-01 | Production Nest provider for `FASHION_KNOWLEDGE_LLM_PORT` | CRITICAL for activation | Platform / API | Provider security + structured-output conformance | FAIL-CLOSED / `MODE_B_PROVIDER_MISSING` | Mode B cannot execute in Nest | Nest provider registered; smoke Claim Lock + Advisor | **OPEN** |
| AD-FK-02 | Consent / analytics platform integration | CRITICAL for telemetry activation | Privacy / Product | Explicit GRANTED consent API | Telemetry disabled / CONSENT_UNAVAILABLE | Cannot enable fashion telemetry | Consent GRANTED path tested; DENIED/UNKNOWN block | **OPEN** |
| AD-FK-03 | Production client Advisor structured fashion context completeness | HIGH | Flutter / Client | DTO `fashion` fields wired from trusted evidence | CLARIFY / UNAVAILABLE when insufficient | Some intents lack usable context | Client sends garments/occasion/evidence refs; stale handled | **PARTIAL / OPEN** |
| AD-FK-04 | Curated Mode A source + human approval | BY DESIGN | Knowledge / Review | Tier A/B sources + proven human approval | Mode A NO_APPLICABLE_CURATED_RULE; ACTIVE=0 | No curated authoritative Mode A advice | First ACTIVE rule via governed release | **OPEN BY DESIGN** |
| AD-FK-05 | Legacy Recommendations surface governance / retirement | HIGH (product boundary) | Product / API | Boundary policy before or with activation | Separate legacy surface outside FKL | Parallel non-FKL fashion recommendations remain | Written boundary CR or route retirement | **OPEN** (required **before** claiming exclusive FKL ownership of fashion prescription; may be post-flag for Advisor-only activation) |

## Activation gate rule
Do **not** set `FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED=true` and `FASHION_KNOWLEDGE_LLM_ENABLED=true` in production until AD-FK-01 is closed (and AD-FK-03 sufficiently ready for intended intents).
