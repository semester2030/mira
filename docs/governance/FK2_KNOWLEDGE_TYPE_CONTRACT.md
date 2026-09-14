# FK-2 — Knowledge Type Contract

Enum: `ESTABLISHED_PRINCIPLE | CONVENTION | DRESS_CODE_RULE | CULTURAL_CONVENTION | TREND | PROFESSIONAL_OPINION | USER_PREFERENCE | LLM_GENERAL_KNOWLEDGE`

Rules enforced via `KNOWLEDGE_TYPE_POLICIES`:
- USER_PREFERENCE is not fashion truth
- LLM_GENERAL_KNOWLEDGE always uncurated
- TREND requires validity metadata
- CULTURAL_CONVENTION requires cultural applicability
- DRESS_CODE_RULE is not universal taste
- No silent default to ESTABLISHED_PRINCIPLE
