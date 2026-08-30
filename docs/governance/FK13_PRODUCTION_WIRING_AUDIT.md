# FK-13 — Production Wiring Audit

## Actual path (symbols)
```
AdvisorController.chat
  → AdvisorService.chat
    → checkAdvisorGuard
    → (optional) MceGroundingPipelineService.build → projectMceSnapshotToEvidenceUnits
    → resolveFashionEvidenceForAdvisorChat
         → detectFashionAdvisorIntent / assembleFashionAdvisorContext
         → runFashionKnowledgeAdvisorBridge
              → tryModeA (registry lookup)
              → runFashionKnowledgeLlm (if LLM on + provider)
              → evaluateFashionClaimLock (via orchestrator / Mode A)
              → projectClaimLockedCandidate
         → projectFashionKnowledgeToEvidenceUnits
    → BeautyAdvisorService.turn
         → runAdvisorTurn → planner → generateGroundedResponse
    → users.writeAuditLog (fashionBridgeInvoked, projectionId, candidateId, claimLock)
    → AdvisorChatResponse { answer, suggestedQuestions, confidence, intent, blocked, disclaimerAr }
```

## Bridge reachability
| Symbol | Production caller | Tests |
|--------|-------------------|-------|
| `resolveFashionEvidenceForAdvisorChat` | `AdvisorService.chat` | fk12 |
| `runFashionKnowledgeAdvisorBridge` | production-wiring (via service) | fk10/fk12 |

Not test-only. Confirmed.
