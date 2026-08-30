# AT-3 — Client Feature Flag

`MiraFeatures.fashionAdvisorV1` ← `--dart-define=MIRA_FASHION_ADVISOR_V1=true`

- Default: **false**
- Does **not** enable backend `FASHION_KNOWLEDGE_*` flags
- AT-4 owns Nest QA activation

When OFF + outfit context: `fashionUnavailable` (Option A — no unrestricted MCE fashion prescription).
