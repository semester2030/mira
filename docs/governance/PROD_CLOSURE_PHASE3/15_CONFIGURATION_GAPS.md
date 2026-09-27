# Phase 3 — Configuration and Runtime Gaps

| Severity | Gap | Evidence | Closure |
|---|---|---|---|
| P0 | committed candidate is not deployed | live entitlements route 404 | deploy only in authorized later phase |
| P0 | Perfect partial-success mapper fabricates fixed concern scores | source mapper defaults | controlled code remediation + tests |
| P0 | TFHub BlazeFace remote cold dependency unproven/timed out | package default URL + probe | bundle/cache/timeout or prove Render cold load |
| P0 | no real provider/E2E proof for Perfect, FASHN or OpenAI | evidence search + safe probes | owner-approved bounded requests |
| P1 | Redis absent; rate/cost limits fail open | Blueprint + service behavior | provision/test or accept risk |
| P1 | avatar Storage path conflicts with committed rules | code `avatars/{uid}.jpg` vs rules directory path | align code/rules and deploy |
| P1 | legacy outfit-intelligence may produce deterministic synthetic scores | reachable controller/service | disable/remove/fail closed |
| P1 | MCE malformed content becomes `parse_fallback` success | MCE parser | classify incomplete/error or approve behavior |
| P1 | live env, plan, logs and metrics remain unknown | Render unauthorized | owner read-only access |
| P1 | Firebase rules/index deploy and real Auth/Admin E2E unknown | no console evidence | owner console verification |
| P1 | minimal observability, no alerts/crash reporting | dependency/code audit | implement or formally accept |
| P1 | notifications are local-only; no FCM/APNs sender | code audit | do not claim push/reminders |
| P2 | hardcoded runtime revision is stale/misleading | health source | inject deploy SHA dynamically |
| P2 | admin portal defaults API base to localhost | static code | set production meta/config |
| P2 | Firebase/Postgres split can make dashboard stats stale | client/API store audit | choose canonical store |
| P2 | YouCam config has dual env aliases | config reader | document canonical names |
| P2 | Flutter feature truth depends on undocumented release dart-defines | build flags | create signed release define manifest |

No direct secret value, paid purchase, DNS change, deploy, migration, public
activation or production data mutation was used to discover these gaps.
