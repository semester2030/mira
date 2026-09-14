# PROD-RC-1 — Defect Register

| ID | Class | Severity | Note | Fix? |
|---|---|---|---|---|
| QA1-ENV-01 / RC1-ENV-01 | ENVIRONMENT | BLOCKER | Production API Service Suspended | No silent fix |
| QA1-ENV-02 | ENVIRONMENT | MINOR | VM Service delayed attach | Observation |
| QA1-ENV-03 / RC1-ENV-03 | ENVIRONMENT | MAJOR | Fashion Mode B blocked — missing LLM key | Needs secret |
| QA1-ENV-04 / RC1-ENV-04 | ENVIRONMENT | MAJOR | Wireless-only launch/VM attach failure | USB required |
| QA1-SRC-01 / RC1-SRC-01 | SOURCE | BLOCKER | Face/Fashion freeze sources untracked | Commit approval |
| QA1-RT-01 / RC1-RT-01 | RUNTIME | MAJOR | `LiveFaceOverlayController` used after dispose | No silent fix |
| RC1-BUILD-01 | BUILD | BLOCKER | `nest build` 2 TS errors in fashion schema-tests | Needs approved fix |
| RC1-FLAG-01 | ARCHITECTURE | BLOCKER (public prod) | Face/Fashion client flags compile-time only | Kill switch CR |
| RC1-INFRA-01 | INFRASTRUCTURE | BLOCKER | `mira-api-qa` not provisioned | Human approval |
| RC1-MCP-01 | TOOLING | MAJOR | Render MCP/CLI unavailable — cannot auto-diagnose suspend | Human Dashboard |
