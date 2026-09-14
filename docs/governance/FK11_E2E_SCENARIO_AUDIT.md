# FK-11 — E2E Scenario Audit (production vs test)

| Scenario | Test (flag ON + mock) | Production `/advisor/chat` | Production MCE (flag OFF) |
|----------|----------------------|----------------------------|---------------------------|
| Red/yellow wedding | Mode B→lock→envelope PASS path in tests | Unavailable stub if integration ON; else no FK | LLM may advise |
| Mode B OFF | Unavailable | Unavailable if integration ON | LLM may advise |
| Integration OFF | N/A | No FK injection | **LLM may advise** |
| Shoes/bag | Mock accessories path | Unavailable stub | LLM may advise |
| Religion | OUT_OF_SCOPE projection | Intent may route; Beauty Advisor unsupported/clarify; MCE may still answer unless quarantined | Risk |
| Body slimming | FK lock/tone blocks | MCE may answer if flag OFF | Risk |

## Probe A/B/C (red/yellow)
- A Integration ON, Mode B ON: Advisor = **unavailable** (not Mode B). MCE quarantined.
- B Integration ON, Mode B OFF: Advisor = unavailable. MCE quarantined.
- C Integration OFF: Advisor = no FK; MCE = **legacy risk**.
