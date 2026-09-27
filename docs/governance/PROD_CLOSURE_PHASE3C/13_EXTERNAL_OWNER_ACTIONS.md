# Phase 3C — External Owner Actions

No action asks the owner to send a secret. Configure credentials only in the
named secure environment.

| # | Provider | Action | Why / blocks | Where | Billing | Secret | Vendor | Priority |
|---:|---|---|---|---|---|---|---|---|
| 1 | Render | Restore read-only workspace access and record service/deploy/env/plan state | deployed identity and live config unknown | Render Dashboard/MCP OAuth | UNKNOWN | NO | Render | P0 |
| 2 | Perfect Corp | Verify existing Skin API product, license, quota and account status; securely configure an acceptance environment | real Skin response/mapping | vendor dashboard + secure non-production env | UNKNOWN | YES | Perfect Corp | P0 |
| 3 | FASHN | Verify existing model access, quota and account; securely configure key/base in acceptance environment | real Fashion response/mapping | FASHN dashboard + secure non-production env | UNKNOWN | YES | FASHN | P0 |
| 4 | LLM | Verify existing account, model, quota and billing; securely configure acceptance environment | real structured response/parser | provider dashboard + secure non-production env | UNKNOWN | YES | LLM vendor | P0 |
| 5 | Firebase | Provide dedicated test identity/test-phone architecture and read-only project access | valid token, Firestore and safe Storage acceptance | Firebase Console/test project | POSSIBLE | YES | Firebase | P0 |
| 6 | Redis/Valkey | Confirm whether a Render instance already exists; if absent, separately approve provisioning and secure wiring | production quota/rate enforcement | Render Key Value | POSSIBLE | YES | Render | P0 |
| 7 | BlazeFace | During deployment acceptance, verify Render TFHub egress/cold start/memory; approve checksum-reviewed bundle remediation only if it fails | real face runtime | isolated Render candidate environment | NO | NO | Render/TFHub | P0 |
| 8 | PostgreSQL | Record read-only migration/schema, SSL/internal URL, pooling, plan and backup state | candidate DB operational acceptance | Render Postgres Dashboard/read-only query | UNKNOWN | NO | Render | P1 |

If any dashboard requires a new subscription, upgrade, credit purchase,
payment authorization or contract acceptance, stop that provider and record
`OWNER_BILLING_ACTION_REQUIRED`.
