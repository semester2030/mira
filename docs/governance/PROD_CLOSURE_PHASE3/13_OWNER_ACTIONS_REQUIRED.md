# Phase 3 — Owner Actions Required

Actions below are read-only unless explicitly marked future remediation.
Do not paste secret values into chat.

| # | Owner action | Where | Evidence to record | Blocks |
|---:|---|---|---|---|
| 1 | Reconnect Render MCP or inspect Dashboard | Render | service/deploy ID, deployed commit, region, plan, auto-deploy, env-name presence, logs/metrics | deployment truth |
| 2 | Verify Postgres plan/expiry/backups/connection limits and migration `20260822190000` | Render | status screenshots/metadata, no URL | DB readiness |
| 3 | Verify Firebase project/billing, phone Auth/quota/regions/test number | Firebase console | enabled products/status only | Auth E2E |
| 4 | Verify/deploy intended Firestore rules/indexes after approval | Firebase console/CLI | deployed version/status | Firestore E2E |
| 5 | Verify Firebase Admin privileged credential can delete a designated test user | Firebase/Render | controlled result only | admin closure |
| 6 | Resolve avatar Storage path vs rule mismatch, then verify deployed rules | source + Firebase | approved remediation/test | avatar E2E |
| 7 | Verify Perfect Skin SKU, production permission, billing, credits, quota, expiry, retention, region/DPA | Perfect console/vendor | status metadata only | Skin provider |
| 8 | Approve one non-private Perfect test image/task | MIRA API/vendor | request ID/status/redacted schema | Skin REAL_RESPONSE/E2E |
| 9 | Verify OpenAI account, billing, model access, token/rate quotas, key-name presence | provider/Render | status and model name only | MCE/Fashion/Advisor |
| 10 | Approve one bounded OpenAI schema request | provider path | redacted response schema/usage | REAL_RESPONSE |
| 11 | Verify FASHN account, billing, credits, model access and key/base presence | FASHN/Render | status metadata only | Fashion provider |
| 12 | Approve one bounded FASHN run/poll task | provider path | redacted job status/output type | REAL_RESPONSE |
| 13 | Provision Redis/Valkey or formally accept fail-open limits | Render | instance/TLS/env-name + limit test | secure launch |
| 14 | Decide and implement TFHub model bundling/cache/timeout or prove Render cold load | source/Render | cold-start log/test | image-analysis availability |
| 15 | Keep subscriptions/store/VTO masters OFF until real integrations and approvals exist | build/Render | release define/env manifest | truth/safety |
| 16 | Add production observability/alerts or formally accept minimal logs | Render/tool of choice | alert/log retention proof | operations |

Owner actions required: `16`. External account verifications: `5` vendor
accounts (Render, Firebase, Perfect Corp, OpenAI, FASHN); Postgres is under
Render. No subscription purchase, secret rotation, deploy, migration or data
mutation was performed.
