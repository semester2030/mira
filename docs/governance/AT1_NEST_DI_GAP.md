# AT-1 — Nest DI Gap

## Current
`AdvisorModule` providers: `AdvisorService`, `BeautyAdvisorService` only.  
`AdvisorService` injects `@Optional() @Inject('FASHION_KNOWLEDGE_LLM_PORT')`.

## Minimum AT-2 registration (plan only)
Module: **`AdvisorModule`** (or small `FashionKnowledgeLlmModule` imported by AdvisorModule)  
Token: `FASHION_KNOWLEDGE_LLM_PORT`  
Factory/class: new production adapter implementing `FashionKnowledgeLlmPort`  
Inject: `ConfigService`  
Exports: not required outside Advisor unless tests need it  
Scope: singleton default  

No Fashion Knowledge Nest module exists today — package is library + AdvisorService import.
