# FK-3 — LLM Adapter Architecture

```
Canonical safe facts
→ projectFashionLlmContext
→ FashionLlmKnowledgeRequest
→ buildFashionLlmPrompt
→ FashionKnowledgeLlmPort.generateStructuredDraft
→ validateFashionLlmDraft
→ mapLlmDraftToCandidate (force UNCURATED)
→ evaluateFashionClaimLock
→ FashionKnowledgeLlmEvaluationResult (INTERNAL)
```

LLM is a temporary candidate generator — not a knowledge owner.
