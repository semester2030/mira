# FK-11 — Technical Debt Audit

| Debt | Class |
|------|-------|
| Bridge not wired to `/advisor/chat` | **REQUIRED_BEFORE_FREEZE** |
| AdvisorChatDto lacks fashion context | **REQUIRED_BEFORE_ACTIVATION** (of Mode B) |
| Default MCE fashion open | **REQUIRED_BEFORE_ACTIVATION** / policy decision |
| `/ai/outfit-intelligence` LLM | **REQUIRED_BEFORE_ACTIVATION** or explicit NON_PROD quarantine |
| Consent gap for telemetry | **REQUIRED_BEFORE_ACTIVATION** (telemetry) |
| ACTIVE=0 | **ACCEPTABLE_FOR_FREEZE** *if* Mode B path honest & wired |
| Public export of fixtures/mock/write | **REQUIRED_BEFORE_FREEZE** (harden) or documented hard boundary |
| No Nest FK module | **FUTURE** / ACCEPTABLE for library |
| Client Flutter wiring | **FUTURE** |
