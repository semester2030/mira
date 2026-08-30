# FK-11 — Production Activation Readiness

## Enabling today
`FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED=true` + `FASHION_KNOWLEDGE_LLM_ENABLED=true`:

**Effects:**
- MCE fashion prescriptions quarantined ✅
- `/advisor/chat` fashion asks → honest unavailable ❌ (not Mode B)
- No Claim Lock Mode B delivery to users ❌

## Requirements before activation of claimed Year-1 Mode B
1. Wire bridge (or equivalent) into Advisor production path with structured outfit context
2. Extend DTO / context binding for garment/outfit/occasion facts
3. Decide MCE default policy (quarantine even when FK off, or accept legacy until cutover)
4. Quarantine or relabel `/ai/outfit-intelligence` for prescriptive advice
5. Keep telemetry off until consent
6. Re-audit (FK-13)

**Activation ready: NO**
