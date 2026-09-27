# Phase 3 — Firebase Production Audit

| Surface | CODE | WIRED | CONFIGURED | REACHABLE | REAL RESPONSE | E2E | Verdict |
|---|---|---|---|---|---|---|---|
| Phone Auth | YES | YES | client config present | SDK target implied | NOT TESTED | NOT PROVEN | PARTIAL |
| Firebase Admin Auth | YES | YES | project env present live; privileged credential unknown | invalid-token guard returned 401 | invalid token rejected only | NOT PROVEN | PARTIAL |
| Firestore | YES | YES | rules/index files present; deployed state unknown | NOT PROBED | NOT PROVEN | NOT PROVEN | PARTIAL |
| Storage | YES | YES | rules present | NOT PROBED | NOT PROVEN | NOT PROVEN | BLOCKED |
| FCM/APNs push | NO sender | NO | messaging dependency disabled | N/A | N/A | N/A | NOT_REQUIRED |
| Analytics | debug stub | NO production SDK | disabled | N/A | N/A | N/A | NOT_IMPLEMENTED |
| Crashlytics | NO | NO | NO | N/A | N/A | N/A | NOT_IMPLEMENTED |
| Remote Config/App Check | NO | NO | NO | N/A | N/A | N/A | NOT_IMPLEMENTED |

## Identity trust graph

Phone OTP → Firebase user → `getIdToken()` → Dio Bearer header →
`FirebaseAuthGuard.verifyIdToken()` → authoritative Firebase UID → Prisma user
and server-side subscription/rate-limit/entitlement checks.

Safe live probes:

- no token: 401 `Missing Authorization Bearer token`;
- invalid non-user token: 401 `Invalid or expired Firebase token`.

No real account, OTP, user, or data mutation was used.

## Verified gaps

1. Avatar code writes `avatars/{uid}.jpg`; committed Storage rules permit
   `avatars/{userId}/{fileName}`. The paths do not match.
2. Production API analysis/history lives in Postgres while dashboard score
   streams still read Firestore analyses.
3. Firebase initialization failure is logged and the Flutter app continues.
4. Entitlements refresh on authenticated splash, not directly after fresh
   login.
5. Deployed rules/indexes, phone-auth region/quota, APNs/reCAPTCHA posture,
   Admin credential, billing and account state require console verification.

## Verdict

`PARTIAL / OWNER_ACTION_REQUIRED`
