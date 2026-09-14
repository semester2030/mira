# FK-1 — Knowledge Rule Model

Recommended canonical concept: **`FashionKnowledgeRule`**

Aligned with Nest fashion-intelligence contracts style (typed fields, version pins, evidence refs) — not Flutter SKU graph.

```
FashionKnowledgeRule
  ruleId, version, knowledgeType, domain
  conditions[], relationships[]
  recommendationPattern   // structured, not user prose
  rationale               // internal editor note / normalized principle
  applicability[], exceptions[]
  subjectivityLevel, confidence
  provenance
  culturalContext[], occasionContext[]
  trendValidity?
  conflictRefs[]
  status, lifecycle
```

FK-2 will freeze schema version `fashion-knowledge-rule-v1`.
Do not treat existing vision `FashionValidatorService` rules as this model.
