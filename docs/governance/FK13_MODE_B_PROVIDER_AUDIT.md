# FK-13 — Mode B Provider Audit

## Implementations found
- `MockFashionKnowledgeLlmProvider` (tests only; not public barrel)
- **No** production HTTP/LLM Nest adapter implementing `FashionKnowledgeLlmPort`

## Production reality (this audit probe)
Integration ON + LLM ON + no provider → bridge invoked → UNAVAILABLE `MODE_B_PROVIDER_MISSING`.

## Severity vs freeze scope
- If claiming **live Mode B service**: MAJOR activation blocker.
- If freezing **Year-1 Mode-B architecture** with explicit activation dependency: acceptable under verdict **B**.

Do not collapse architecture readiness with production activatability.
