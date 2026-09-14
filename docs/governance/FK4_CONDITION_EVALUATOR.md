# FK-4 — Condition Evaluator

Reuses FK-2 Condition contract. Supported operators (fail-closed otherwise):
EQUALS, NOT_EQUALS, IN, NOT_IN, EXISTS, NOT_EXISTS, CONTAINS, ANY_OF, ALL_OF, RANGE, GREATER_THAN, LESS_THAN.

Unsupported operator/type → false (fail closed).
