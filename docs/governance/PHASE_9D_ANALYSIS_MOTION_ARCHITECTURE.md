# Architecture

```
Start analysis → pipeline=running
→ AnalysisMotionCoordinator (elapsed + pipeline)
→ phases: settling → contourReveal → scanPass(once) → ambientWait
→ success → completing → handoff → existing result navigation
```

Soft laser progress ≠ analysis progress.
