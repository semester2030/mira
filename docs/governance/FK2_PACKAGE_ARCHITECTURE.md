# FK-2 — Package Architecture

```
fashion-knowledge/
  contracts/          # enums + DTOs
  knowledge/          # FashionKnowledgeRule
  advice/             # Candidate + LLM policy
  claim-lock/         # evaluateFashionClaimLock
  provenance/         # (types live in contracts/provenance)
  subjectivity/       # (types live in contracts/subjectivity)
  conflict/           # curated precedence
  runtime/            # clock + evaluation context
  validation/         # validators + tone safety
  versioning/         # pins
  ports/              # future FK-3…FK-10 interfaces
  fixtures/           # TEST_ONLY only
  index.ts
```

Ownership: knowledge contracts + advice eligibility only.  
Does **not** own GI/OI/SI/Wardrobe/Advisor.
