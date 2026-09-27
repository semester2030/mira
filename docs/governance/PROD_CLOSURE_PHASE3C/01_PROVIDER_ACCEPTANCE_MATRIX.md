# Phase 3C — Provider Acceptance Matrix

Statuses describe evidence at source
`4b2c78ac42fef38dc0012a35ba6879ae4d6a4a74`. Local-only acceptance is not
promoted to production acceptance.

| Dependency | CODE | WIRED | CONFIGURED | ACCOUNT | CREDENTIAL | REACHABLE | REAL REQUEST | REAL RESPONSE | CANONICAL MAPPING | FAILURE SAFETY | E2E | LATENCY | BILLING/QUOTA | OWNER ACTION | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Perfect Corp | PASS | PASS | PARTIAL | UNKNOWN | PARTIAL | PASS | NOT_TESTED | NOT_TESTED | PARTIAL | PASS | NOT_TESTED | NOT_TESTED | UNKNOWN | PASS | PARTIAL |
| FASHN | PASS | PASS | PARTIAL | UNKNOWN | UNKNOWN | PASS | NOT_TESTED | NOT_TESTED | NOT_TESTED | PASS | NOT_TESTED | NOT_TESTED | UNKNOWN | PASS | PARTIAL |
| OpenAI-compatible LLM | PASS | PASS | PARTIAL | UNKNOWN | UNKNOWN | PASS | NOT_TESTED | NOT_TESTED | NOT_TESTED | PASS | NOT_TESTED | NOT_TESTED | UNKNOWN | PASS | PARTIAL |
| Firebase Auth | PASS | PASS | PASS | UNKNOWN | NOT_REQUIRED | PASS | PARTIAL | PARTIAL | NOT_REQUIRED | PASS | NOT_TESTED | PARTIAL | UNKNOWN | PASS | PARTIAL |
| Firebase Admin | PASS | PASS | PASS | UNKNOWN | PARTIAL | PASS | PARTIAL | PARTIAL | NOT_REQUIRED | PASS | NOT_TESTED | PARTIAL | UNKNOWN | PASS | PARTIAL |
| Firestore | PASS | PASS | PASS | UNKNOWN | NOT_REQUIRED | UNKNOWN | NOT_TESTED | NOT_TESTED | NOT_REQUIRED | PASS | NOT_TESTED | NOT_TESTED | UNKNOWN | PASS | PARTIAL |
| Firebase Storage | PASS | PASS | PASS | UNKNOWN | NOT_REQUIRED | PARTIAL | PARTIAL | PARTIAL | PASS | PASS | NOT_TESTED | PARTIAL | UNKNOWN | PASS | PARTIAL |
| Redis/Valkey | PASS | PASS | PARTIAL | UNKNOWN | UNKNOWN | PARTIAL | PARTIAL | PARTIAL | PASS | PASS | NOT_TESTED | PARTIAL | UNKNOWN | PASS | PARTIAL |
| BlazeFace/TFHub | PASS | PASS | PASS | NOT_REQUIRED | NOT_REQUIRED | FAIL | FAIL | FAIL | NOT_TESTED | PASS | FAIL | PASS | NOT_REQUIRED | PASS | FAIL |
| PostgreSQL/Prisma | PASS | PASS | PASS | UNKNOWN | PARTIAL | PASS | PASS | PASS | NOT_REQUIRED | PARTIAL | PARTIAL | PASS | UNKNOWN | PASS | PARTIAL |
| Render live API | PASS | PASS | PASS | UNKNOWN | NOT_REQUIRED | PASS | PASS | PASS | NOT_REQUIRED | PARTIAL | PARTIAL | PASS | UNKNOWN | PASS | PARTIAL |

Notes:

- Perfect live health proves only selector and key-presence booleans; no real
  provider result.
- Redis read/write/TTL acceptance was against the existing local instance, not
  Render.
- Firebase Storage real behavior was emulator-proven; no production object was
  written.
- PostgreSQL production reachability is proven through the live Prisma-backed
  public stats route, not by Dashboard or migration inspection.
- `OWNER ACTION = PASS` means the unresolved action is precisely identified,
  not that it has been completed.
