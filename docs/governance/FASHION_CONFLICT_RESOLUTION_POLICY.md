# FK-1 — Conflict Resolution Policy

Default priority for **domain guidance** (when user has not stated conflicting goal):
1. Safety / anti-harm tone
2. Applicable reviewed cultural + dress-code (if user context matches)
3. Established principle
4. Convention
5. Professional opinion
6. Trend
7. LLM general

**User preference / style goal never silently overwritten.**  
If wedding restraint vs bold goal: emit **alternatives** (preserve bold / calm formal / hybrid) + `preferenceConflict=true` + `PASS_WITH_QUALIFICATION`.

Clarification required when occasion missing for dress-code rules.
