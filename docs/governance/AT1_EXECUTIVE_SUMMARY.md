# AT-1 — Production Activation Discovery & Readiness Audit

**Date:** 2026-08-10  
**Mode:** READ-ONLY discovery  
**Authority:** FK-14 Platform Freeze `MIRA-FK-FREEZE-1.0.0` + FK-13 verdict **B**

## Primary answer
Between frozen platform and a real user receiving Year-1 Mode-B fashion advice, the gap is **not** curated Mode A (ACTIVE=0 is OK). The real blockers are:

1. **AD-FK-01** — No Nest production `FashionKnowledgeLlmPort` implementation/registration  
2. **AD-FK-03 (elevated)** — Flutter “اسألي ميرا” primary UX calls **MCE consultation SSE**, not `POST /advisor/chat`. `AdvisorApiDataSource` exists but has **zero production callers**. Fashion DTO is never sent.  
3. Flags remain default **false**; Render does not declare FKL flags (safe).

Telemetry consent (**AD-FK-02**) does **not** block advice activation if telemetry stays OFF.  
Curated Mode A (**AD-FK-04**) does **not** block Year-1 Mode B.  
Legacy Recommendations (**AD-FK-05**) is an ownership/boundary issue, not a Nest Mode-B provider blocker.

## Recommendation (no implementation)
- **Provider strategy:** **B** — separate FKL OpenAI adapter reusing `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` (optional `FASHION_KNOWLEDGE_LLM_*` overrides); do **not** call `MceLlmService` directly.  
- **Register** provider in `AdvisorModule` under token `FASHION_KNOWLEDGE_LLM_PORT`.  
- **Client AT-3 must route fashion-prescriptive turns to `/advisor/chat` with `fashion` context**; MCE remains quarantined for fashion (Option A).

## Verdict for next phases
AT-2: Production LLM Provider (Nest)  
AT-3: Client path + fashion context (critical — larger than originally assumed)  
AT-4: Controlled QA activation  
AT-5: Independent activation audit  
AT-6: Production Activation Certificate  

AT-1 performs **no** wiring/enablement.
