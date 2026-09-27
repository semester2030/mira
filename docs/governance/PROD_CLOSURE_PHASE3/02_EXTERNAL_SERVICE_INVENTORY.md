# Phase 3 — External Service Inventory

Baseline: `584be7fcd9486b17ba97569debe8b9aacf90408a`.

Terminology is deliberately layered: CODE, WIRED, CONFIGURED, REACHABLE,
REAL_RESPONSE and E2E are independent claims.

| # | Service | Purpose | Class | Code / wiring | Verified runtime state | Account / cost / quota | Fallback / failure | Verdict |
|---:|---|---|---|---|---|---|---|---|
| 1 | Render web/static hosting | API and three static sites | PRODUCTION_CRITICAL | `render.yaml` | API REACHABLE, candidate not deployed; dashboard access unauthorized | account/plan verification required; COST UNKNOWN | service outage blocks API | PARTIAL |
| 2 | Render PostgreSQL | primary API persistence | PRODUCTION_CRITICAL | Prisma + `DATABASE_URL` | live DB read proven through `/website/stats` | expiry/backups/plan unknown | boot/migration fails closed | READY_WITH_EXTERNAL_VERIFICATION |
| 3 | Firebase | phone Auth, client Firestore/Storage, Admin identity | PRODUCTION_CRITICAL | Flutter SDKs + Admin guard | auth guard reachable; real OTP/Firestore/Storage E2E not run | console verification required; billing/quota unknown | auth fails closed; Firebase init/client profile may degrade | PARTIAL |
| 4 | Perfect Corp YouCam Skin | skin analysis | PRODUCTION_CRITICAL | upload → task → poll → mapper | live health: selected + key PRESENT; no real response proof | license, billing, credits, rate/retention unknown | canonical mock blocked; partial response receives synthetic defaults | BLOCKED |
| 5 | OpenAI-compatible LLM | fashion semantics, MCE, FK Mode B | FEATURE_CRITICAL | four server callers | vendor endpoint REACHABLE (401 unauth); live key/model/response unknown | account/billing/quota required; status unknown | canonical vision/FK fail closed; MCE parse fallback | PARTIAL |
| 6 | FASHN.ai | fashion geometry and recolor | FEATURE_CRITICAL | run → poll → output/QEL | vendor endpoint REACHABLE (401 unauth); live key/response unknown | account/billing/credits/quota unknown | canonical path fails closed | PARTIAL |
| 7 | Redis / Valkey | rate limits, MCE quota/cache | REQUIRED_FOR_SECURE_LAUNCH | `ioredis` service wired | absent from Blueprint; production instance not proven | instance/account needed | **fails open**: limits skipped | BLOCKED |
| 8 | TensorFlow Hub | BlazeFace model downloaded at first server use | PRODUCTION_CRITICAL hidden dependency | `blazeface.load()` default URL | direct model probe timed out; no bundled model/cache | no credential; availability dependency | model-init failure can block image face gate | BLOCKED |
| 9 | Google Fonts CDN | static-site Tajawal fonts | OPTIONAL | HTML links | target not separately E2E-tested | no account | browser font fallback | PARTIAL |
| 10 | Marketplace retailers | outbound product links | OPTIONAL | local catalog + `url_launcher` | user-triggered only | commercial relationships unknown | external browser failure only | NOT_PROVEN |
| 11 | `mira.app` public domain | privacy/support URLs | OPTIONAL | dart-define default | domain ownership/DNS not audited | owner/DNS action if launch-critical | links fail independently | NOT_PROVEN |
| 12 | Perfect Makeup VTO / Banuba | future beauty try-on | DISABLED / LEGACY_REGISTRY | registry only; no live adapter | `BEAUTY_TRYON_ENABLED=false` | license/billing unknown | disabled adapter, no fabricated image | NOT_REQUIRED |
| 13 | RevenueCat / App Store / Play billing | future subscriptions | NOT_IMPLEMENTED | no SDK/receipt verification; webhook 501 | disabled | account/review/billing future | fail closed | NOT_REQUIRED |

Production-critical/secure-launch services: `8` (Render, Postgres, Firebase,
Perfect Skin, OpenAI, FASHN, Redis, TFHub). OpenAI/FASHN are critical to the
intended Fashion/Advisor journeys even though those journeys remain disabled
or unproven.

No SMTP, maps API, payment processor, push sender, Remote Config, App Check,
Crashlytics, Sentry, Datadog, OpenTelemetry collector, or Prometheus backend is
wired.
