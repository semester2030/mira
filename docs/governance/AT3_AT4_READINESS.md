# AT-3 — AT-4 Readiness

Client can send structured fashion context to `POST /advisor/chat`.

AT-4 must:
1. Enable `FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED` + `FASHION_KNOWLEDGE_LLM_ENABLED` in **QA only**
2. Keep telemetry OFF
3. Run Flutter with `MIRA_FASHION_ADVISOR_V1=true` + real provider smoke
4. Not flip production Render flags without activation certificate

Do not begin AT-4 in this phase.
