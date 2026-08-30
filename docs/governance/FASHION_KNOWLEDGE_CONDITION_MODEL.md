# FK-1 — Condition Model

Conditions resolve **only** against Mira-owned facts:

- GI: category, type, colors[], pattern?, material?, fit?, sleeve?, neckline?
- OI projection (when available): slots, metrics polarity, occasionFit, harmony evidence ids
- Context: occasionId, season?, culturalContextId?
- SI read-only: preferences, goals, memory tags
- Explicit absences → `NEED_CLARIFICATION` or skip rule — never invent attributes

No provider field names in conditions. No raw vision topology required when CanonicalGarment suffices.
