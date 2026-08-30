# AT-3 — Context Trust Policy

Client-supplied fashion facts are USER/CLIENT asserted only.

## Forbidden in request JSON
sourceType, provenance, provenanceState, approvalStatus, claimLock,
claimLockDecision, knowledgeRuleIds, ACTIVE, uncurated, provider,
envelopeId, traceId

Server remains authority for Claim Lock, UNCURATED forcing, and confidence caps.
