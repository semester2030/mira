# FK-11 — Production Wiring Audit

## Evidence

| Entry | Calls bridge? | Calls Claim Lock? | Mode B? |
|-------|---------------|-------------------|---------|
| POST `/advisor/chat` | NO | NO | NO |
| MCE `/consultation/.../messages` | NO | NO | NO (quarantine or free LLM) |
| MCE stream | NO | NO | NO |
| `phase-fk10` tests | YES | YES (via bridge) | YES (mock) |

## AdvisorService evidence
File: `mira-api/src/advisor/advisor.service.ts`  
Uses: `projectNoKnowledge`, `projectFashionKnowledgeToEvidenceUnits`.  
Does **not** import/call `runFashionKnowledgeAdvisorBridge`.

## DTO gap
`AdvisorChatDto` = `{ message, analysisId? }` only. Cannot bind garment/outfit facts for Mode B.

## Classification
**MAJOR — production integration not actually wired** to claimed E2E path.
