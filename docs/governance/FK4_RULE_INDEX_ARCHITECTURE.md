# FK-4 — Rule Index Architecture

Deterministic in-memory indexes over a validated registry:
- byRuleId, byDomain, byKnowledgeType, byStatus
- byOccasion, byCulturalContext, bySourceType
- bySubjectivity, byConfidence, byTrendState

No search infrastructure beyond sorted index maps. Rebuild on load.
