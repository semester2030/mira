# FK-4 — Rule Lookup Contract

## Input
`FashionKnowledgeLookupQuery` — domain, facts, occasion, dress code, cultural context, style goal, preference context, explicit clock, min confidence, knowledge types, active-only, subjectivity filters.

## Output
`FashionKnowledgeLookupResult` — matchedRules, excludedRules, conflictRefs, appliedFilters, registryVersion, snapshotId, queryHash, reasonCodes, runtime.

Returns **rules**, not advice. Does not invoke FK-3 LLM.
