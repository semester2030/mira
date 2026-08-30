# FK-11 — Claim Lock Audit

## Gates G1–G15
Implemented in `claim-lock/claim-lock-runtime.ts` with real branching. Not documentation stubs.

## Production enforcement
Library path via `runFashionKnowledgeLlm` / bridge always evaluates lock before `projectClaimLockedCandidate`.

## Gap
Production `/advisor/chat` never reaches Claim Lock because it never builds candidates.

## Vacuous notes (MINOR)
G8 passes when `knowledgeRuleIds` empty (typical Mode B). Not a stub — conditional.

## Bypass of lock for suggestions
`projectNoKnowledge` / `projectOutOfScope` do not emit suggestion content. Acceptable.
