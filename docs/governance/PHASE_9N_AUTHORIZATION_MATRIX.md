# Authorization Matrix

| Attack | Expected | Evidence |
|---|---|---|
| User A → analysisId of B | empty units | `findFirst({ id, userId })` returns null |
| Missing analysisId | empty / no Face units | chat requires dto.analysisId for load |
| Nested face.analysisId as load key | not used | load uses top-level analysisId only |
| Nested mismatch | selection collapsed to generalFaceResult | AdvisorService L258–272 |

**Test level:** code-path proof. Live multi-user HTTP IDOR not in CI → OBSERVATION / ACTIVATION_QA.
