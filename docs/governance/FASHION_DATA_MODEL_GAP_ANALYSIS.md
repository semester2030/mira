# Fashion Data Model Gap Analysis

| Concept | Status |
|---|---|
| FashionRule | EXTENDABLE name exists for vision validator — **not** domain styling KB model |
| RuleCondition / RuleRecommendation / RuleException | MISSING |
| RuleApplicability / RuleEvidence / RuleSource | MISSING |
| RuleConfidence / RulePriority / RuleConflict | MISSING as fashion-KB types (SI has decision priority bands) |
| CulturalContext | MISSING (modestyPolicy partial) |
| OccasionContext | PARTIAL — occasionId + ContextEngine |
| ColorRelationship | PARTIAL Flutter enum; MISSING Nest contract |

Existing OI Evidence Graph + Advisor Envelope **can host citations** if a knowledge layer emits evidence units — EXTENDABLE integration point.
