# Account Deletion Remediation

Bounded source changes:

- `UsersService.deleteAccount` no longer swallows Firebase Admin failures.
- missing `FIREBASE_PROJECT_ID`, ADC initialization failure, Admin
  unavailability, and `deleteUser` errors become a sanitized 503 with code
  `ACCOUNT_IDENTITY_DELETE_FAILED`.
- only SDK code `auth/user-not-found` is accepted as idempotent completion.
- logs contain an error classification only; no UID, path, credential, or
  private detail.
- database-first order is preserved so an active Firebase identity can retry
  after a partial database cleanup.

Runtime configuration remediation:

- retained ADC file-path loading;
- mounted `firebase-sa.json` through Render Secret Files;
- no credential entered source, Flutter, governance evidence, or ZIP.

Scope exclusions held: no provider, Redis, PostgreSQL schema, Firebase Storage,
billing, Fashion laws, or Advisor laws were changed.
