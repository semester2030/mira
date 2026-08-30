# AT-1 — Activation Dependency Reclassification

| ID | FK-14 status | AT-1 classification | Notes |
|----|--------------|---------------------|-------|
| AD-FK-01 Nest LLM provider | OPEN | **BLOCKS_MODE_B_ADVICE_ACTIVATION** | Required |
| AD-FK-02 Consent | OPEN | **BLOCKS_TELEMETRY_ONLY** | Advice can launch with telemetry OFF |
| AD-FK-03 Client context/path | PARTIAL | **BLOCKS_MODE_B_ADVICE_ACTIVATION** | Elevated: unused `/advisor/chat` + no fashion DTO |
| AD-FK-04 Curated Mode A | OPEN BY DESIGN | **DOES_NOT_BLOCK_YEAR1** | ACTIVE=0 OK |
| AD-FK-05 Recommendations legacy | OPEN | **ACCEPTED_LEGACY_BOUNDARY** for Mode B advice activation; **BLOCKS_BEFORE_FULL_RELEASE** if claiming exclusive FKL fashion SSOT |

## Telemetry vs Advice
Mode B advice **can** launch with `FASHION_KNOWLEDGE_TELEMETRY_ENABLED=false`. Separate advice activation from telemetry activation.
