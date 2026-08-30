# FK-4 — Risk Register

| ID | Risk | Mitigation |
|----|------|------------|
| R1 | Premature production rules | Empty prod registry enforced |
| R2 | LLM writes curated knowledge | llm-write-guard + tests |
| R3 | TEST_ONLY leakage | production loader rejects |
| R4 | Silent invalid registry | fail-closed validation |
| R5 | Circularity in supersession | cycle detection blocks publish |
| R6 | Implicit wall-clock trends | explicit clock required |
