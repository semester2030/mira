# PHASE 9J — Retake Reset

On pop token, NewAnalysisScreen clears `_capturedImage` → FaceCapturePanel `didUpdateWidget` resets mirror latch/hold/readiness.
Result Mirror selection / guidance / Advisor context die with the popped route (new analysis binds fresh).
