# FK13 FEATURE FLAG AUDIT

Defaults false in code. `render.yaml` does not set FASHION_KNOWLEDGE_* unsafe true. Cases A–G: OFF→quarantine; ON+LLM OFF→unavailable; ON+LLM ON+no provider→MODE_B_PROVIDER_MISSING; telemetry without consent→no events.
