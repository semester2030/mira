# PHASE 9O — Protected Components

| Component | Owner | Version | Protection | Allowed change | Regression |
|---|---|---|---|---|---|
| Capture readiness evaluator/policy | Capture Experience | face-capture-readiness-v1 | SEMANTIC | MAJOR/MINOR CR | Face suite + capture tests |
| Capture latch / hold window | Capture Experience | latch/hold v1 | SEMANTIC | MAJOR/MINOR CR | Face suite |
| Contour reducer (≤18) | Capture Experience | contour-reduce-v1 | SEMANTIC | MAJOR/MINOR CR | Face suite |
| Soft Laser / motion truth | Analysis Motion | motion-truth-v1 | LAW #41 | MAJOR CR | phase_9d + Face suite |
| Face Result Projector | Projection | face-result-projection-v1 | SEMANTIC | MAJOR/MINOR CR | 9E tests + Face suite |
| Insight cap / next action / numeric policy | Projection | projection pins | SEMANTIC | MAJOR CR | Face suite |
| Detail / guidance ownership | Details/Guidance | detail/guidance v1 | OWNERSHIP | MAJOR CR | 9G/9H tests |
| Face Advisor context + server reconcile | Advisor binding | face-advisor-context-v1 | TRUST | **not PATCH-weakened** | trust suite + phase7b |
| History comparability / retake | History | history/comparison v1 | SEMANTIC | MAJOR CR | 9J tests |
| Visual truth classes | Presentation | enum | LAW #40 | MAJOR CR | truth tests |
| Feature flag defaults OFF | Config | MiraFeatures | ACTIVATION | activation track only | flag tests |

## Non-protected (PATCH-allowed if non-semantic)
Widget decomposition, non-semantic cleanup, perf micro-opts, minor a11y/RTL layout fixes that do not change ownership/truth/claims.
