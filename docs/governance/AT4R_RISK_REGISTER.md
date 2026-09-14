# AT-4R — Risk Register

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R1 | Enable FKL on production Render | High | Explicit forbid; scripts local-only |
| R2 | Commit secrets | High | `.env.qa` gitignored; example only committed |
| R3 | Flutter default URL → production | High | Require `MIRA_API_BASE_URL` override |
| R4 | AUTH_SKIP on production | High | Documented local-only |
| R5 | Live skipped but reported pass | High | Proof JSON `liveProviderExecuted` gate |
| R6 | Telemetry accidentally on | Med | Export script refuse |
| R7 | Legacy MCE fashion on during live | High | Export script refuse |
| R8 | Cost runaway | Low | Small live suite; no loops |
