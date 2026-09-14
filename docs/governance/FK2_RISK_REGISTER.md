# FK-2 — Risk Register

| ID | Risk | Mitigation |
|---|---|---|
| R1 | FK-3 wires LLM without Claim Lock | Ports + policy require draft→lock path |
| R2 | TEST_ONLY fixtures treated as prod | `testOnly` + `assertNoProductionRules` |
| R3 | Silent curated overwrite by LLM | `resolveCuratedOverLlm` |
| R4 | Attractiveness language | Tone safety + G14 |
| R5 | False citations | G13 FALSE_PROVENANCE |
