# FK-11 — LLM Trust Boundary Audit

## Verified
- `mapLlmDraftToCandidate` forces `LLM_GENERAL_KNOWLEDGE` + `UNCURATED` provenance
- G5 blocks LLM-as-curated
- Confidence caps: HIGH→MEDIUM (+ subjectivity caps)
- Structured draft validation; absoluteClaim/knownRuleWording forced false on map
- Feature flag `FASHION_KNOWLEDGE_LLM_ENABLED` default false

## Provider cannot set
approvalStatus curated, sourceType mira_curated, rule ACTIVE — overwritten/rejected.

## Direct prose to user
Bridge path: projection narrates from Claim-Locked fields, not raw provider string.  
MCE path (flag off): **can** emit free-form fashion prose — bypass finding.
