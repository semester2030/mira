# FK-11 — Remediation Requirements (FK-12 input)

## Must fix before freeze (FK-12)
1. **Wire** `runFashionKnowledgeAdvisorBridge` (or equivalent) into production Advisor path with Claim Lock before projection.
2. **Supply** structured fashion context (outfit/garment/occasion/preference) to the bridge — DTO or upstream binding.
3. **Close default MCE fashion bypass** with an explicit product policy (quarantine-by-default OR documented temporary legacy + cutover plan enforced in code).
4. **Contain** `/ai/outfit-intelligence` prescriptive LLM for Advisor-equivalent fashion claims.
5. **Harden** package exports (fixtures/mock/write) or enforce hard import boundaries.
6. **Correct** governance docs to match wiring truth.
7. Keep telemetry disabled until consent; if enabling, add consent gate.
8. Add HTTP/integration tests proving production path ≠ test-only bridge.
9. Re-run **FK-13 Independent Re-Audit** before FK-14 freeze.

## Must not do in FK-11
No production code changes in this audit phase.
