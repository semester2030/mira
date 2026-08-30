# PROD-FINAL-1 — Kill Switch

Without new binary:
1. Set `MIRA_FASHION_MODE_B_MASTER_ENABLED=false`
2. Set `MIRA_FACE_EXPERIENCE_MASTER_ENABLED=false`
3. Or clear/remove UID from `MIRA_PRODUCTION_INTERNAL_UIDS`

Expected: all users (including owner) return to legacy/default paths; Fashion Mode B does not execute.
