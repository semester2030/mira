# PHASE 9I — Feature Flag Report

**Decision:** follow `MIRA_FACE_RESULT_MIRROR_V1` (default false).
No separate `MIRA_FACE_ADVISOR_CONTEXT_V1` — Face context only assembled on Result Mirror which is already gated.
Tradeoff documented: enabling Mirror enables contextual Advisor path for Face entries.
