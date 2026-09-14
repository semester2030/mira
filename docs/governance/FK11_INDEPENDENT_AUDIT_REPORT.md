# FK-11 — Independent Production Audit Report

**Mode:** READ ONLY · EVIDENCE ONLY · NO FIXES  
**Claimed release audited:** `0.9.0-fashion-knowledge-advisor-integration`  
**Audit date:** 2026-08-10

## Method
Documentation is not evidence. For critical claims this audit verified:
1. code symbols/paths
2. production call paths
3. flag/runtime behavior
4. tests (re-executed)
5. negative paths / bypasses

## Actual production architecture (verified)

### Library path (exists, tested)
```
FashionLlmKnowledgeRequest
→ Registry Mode A lookup (ACTIVE=0)
→ optional Mode B runFashionKnowledgeLlm
→ evaluateFashionClaimLock (G1–G15)
→ projectClaimLockedCandidate
→ FashionKnowledgeAdvisorProjection
→ projectFashionKnowledgeToEvidenceUnits
→ sealAdvisorEvidenceEnvelope
→ planConversation / generateGroundedResponse
```
**Callers of `runFashionKnowledgeAdvisorBridge`:** schema tests only (`phase-fk10-*.ts`). Zero production HTTP callers.

### Production `/advisor/chat` path (verified)
```
AdvisorController.chat
→ AdvisorService.chat
  → optional MCE skin grounding → projectMceSnapshotToEvidenceUnits
  → IF integration flag ON AND fashion prescriptive intent AND no fashion.knowledge.* units:
       projectNoKnowledge (reason ADVISOR_CHAT_REQUIRES_FASHION_BRIDGE_CONTEXT)
       → projectFashionKnowledgeToEvidenceUnits
  → BeautyAdvisorService.turn → seal → plan → grounded response
```
**Never calls:** registry lookup, Mode B LLM, Claim Lock, or full bridge.

### Production MCE consultation path (verified)
```
ConsultationController messages / stream
→ ConsultationOrchestratorService
  → evaluateMceFashionQuarantine (ONLY if FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED)
  → else MceLlmService.complete/stream (can narrate fashion from CONTEXT facts)
```

## Critical findings
None that meet CRITICAL definition for *intended activated* config inventing Claim-Lock-bypass fashion *through Advisor envelope*.  
However: **default-off** leaves MCE open; **activation ON** does not deliver Mode B — only unavailable/quarantine. That is freeze-blocking MAJOR.

## Major findings (summary)
1. Bridge not production-wired
2. Default MCE fashion bypass
3. `/advisor/chat` DTO cannot supply Mode B context
4. FK-10 docs overstated wiring
5. `/ai/outfit-intelligence` remains LLM fashion BYPASS_RISK
6. Broad public exports (fixtures ACTIVE test rules, mock LLM, saveDraftRegistry)
7. Telemetry consent DOCUMENTED_GAP (safe while flag false; unsafe if enabled)

## Minor / informational
- G8 vacuous on Mode B (empty ruleIds) — by design
- Law #34 validates claim keys/citations, not free-form prose outside grounded engine (engine only speaks envelope statements)
- Pre-existing tsc Jest globals in unrelated vision recolor specs; eslint binary missing in env

## Final recommendation
Do **not** freeze. Proceed **FK-12 Remediation** → **FK-13 Independent Re-Audit** → then consider FK-14.
