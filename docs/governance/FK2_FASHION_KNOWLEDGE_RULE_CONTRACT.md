# FK-2 — Fashion Knowledge Rule Contract

`FashionKnowledgeRule` fields per FK-1 lock (ruleId, schemaVersion, ruleVersion, knowledgeType, domain, conditions, recommendationPattern, rationale, applicability, exceptions, subjectivity, confidence, provenance, occasion/cultural contexts, trendValidity?, conflictRefs, status, lifecycle, testOnly?).

`isProductionEligibleRule` requires ACTIVE+ACTIVE and `testOnly !== true`.
FK-2 ships **zero** production rules.
