# Phase 3C — Firebase Acceptance

## Configuration

- Flutter Firebase options, Android configuration and iOS configuration:
  present;
- backend uses `FIREBASE_PROJECT_ID` plus Application Default Credentials;
- live invalid-token request reached Firebase Admin verification behavior and
  was rejected as invalid/expired;
- no secret, ID token or service-account JSON was printed or copied.

## Auth and Admin

- missing Bearer token on live protected route: `HTTP 401` (517 ms);
- invalid Bearer token: `HTTP 401` (503 ms);
- rejection category proves configured Admin verification path;
- valid dedicated test sign-in/token/backend acceptance: `NOT_TESTED`.

No dedicated production test identity, test phone or approved credential was
found. The repository documents use of a Firebase test account but does not
define one. A production account was not created speculatively.

## Firestore

Client code/configuration is present. No authenticated safe production read was
available without a test identity, so production authorization/connectivity is
`UNKNOWN`. Emulator evidence does not prove production Firestore.

## Storage

The committed Avatar contract and isolated Auth/Storage emulator were rerun:

- canonical owner write: PASS;
- authenticated read: PASS;
- unauthenticated and cross-user denial: PASS;
- MIME, size and legacy flat-path denial: PASS.

Production rules deployment and production write/read/delete were not tested.
No real user namespace or object was touched.

## Verdict

- Firebase Auth: `PARTIAL`
- Firebase Admin: `PARTIAL`
- Firestore: `PARTIAL`
- Firebase Storage: `PARTIAL`

Owner action: provide a dedicated test identity/test-phone architecture and
read-only project access; deploy reviewed rules only in a separately authorized
deployment step.
