# FK-1 — LLM Hybrid Strategy

```
Context (garments + occasion + prefs + policy)
→ LLM structured draft FashionAdviceCandidate
→ Claim Lock
→ PASS_WITH_QUALIFICATION (typical) | BLOCK
→ Advisor narration
```

Hard requirements:
- Deterministic JSON schema
- `sourceType=llm_general_knowledge`, `provenanceState=uncurated`
- Confidence cap
- No fabricated books/designers/industry rules
- No product SKU invention
- No “established principle” wording unless curated rule id attached

Mode B is temporary bridge for 12 months — not Mira truth.
