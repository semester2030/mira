# Fashion Test Coverage Audit

| Area | Tests | Gap |
|---|---|---|
| GI schema | `test:phase6c` | — |
| OI schema | `test:phase6d` | HTTP analyze↔OI integration |
| SI schema | `test:phase6e` | HTTP surface |
| Wardrobe | `test:phase6b` | durable store/HTTP |
| Vision FashionRule | vision-pipeline.schema-tests | — |
| Beauty Advisor Law34/provenance | phase7b | fashion free-text |
| MCE answer non-hallucination | eval cases schema-only | **no live content assertion** |
| Flutter color/compat/outfit | `test/fashion_*`, outfit_* | dual-stack drift vs Nest public contract |

Untested production behavior: MCE invented swaps; end-to-end red+yellow+wedding structured advice.
