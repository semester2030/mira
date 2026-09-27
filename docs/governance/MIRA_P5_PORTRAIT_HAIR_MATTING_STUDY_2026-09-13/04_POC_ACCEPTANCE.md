# POC plan + acceptance metrics

Do not execute until owner authorizes images + spend.

Pipelines: Apple PersonSeg Accurate | Apple ForegroundMask | Perfect SOD | Photoroom
Scenes: straight / curly / dark-on-dark / light / sofa-room / ears-jaw
Composite: pure black + Perfect concern overlay alignment check

Pass metrics: hair preservation, BG leakage <0.5%, halo≈0 on black, jaw/ear intact, Perfect offset=0, latency/memory budgets
Fail: scissor hair, halo, sofa leak, mask shift
