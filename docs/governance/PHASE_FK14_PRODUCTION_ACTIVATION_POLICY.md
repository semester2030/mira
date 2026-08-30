# PHASE FK14 PRODUCTION ACTIVATION POLICY

# Production Activation Policy (NOT part of FK-14 execution)

Activation is a **separate track**. Before enabling
`FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED=true` and
`FASHION_KNOWLEDGE_LLM_ENABLED=true` require:

1. Real Nest LLM provider (AD-FK-01)
2. Provider security/config review
3. Timeout/retry configuration
4. Structured-output conformance test
5. Claim Lock production smoke
6. Full Advisor smoke
7. Safe flag matrix verification
8. Client fashion context readiness (AD-FK-03)
9. MCE quarantine verification
10. No legacy bypass regression
11. Production observability
12. Rollback/off switch verified
13. Consent policy if telemetry enabled (AD-FK-02)

FK-14 does **not** enable any flags.
