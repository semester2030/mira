# Firebase Admin Runtime Forensic

Task: `MIRA-P4B-FINAL-CLOSURE-2026-08-31`

## Trace

`main.ts` boots Nest. `FirebaseAuthGuard` and `UsersService.deleteFirebaseUser`
initialize the default Firebase Admin app with
`admin.credential.applicationDefault()` plus `FIREBASE_PROJECT_ID`.
`UsersService.deleteAccount` ultimately calls `admin.auth().deleteUser(uid)`.

## Production finding

- `GOOGLE_APPLICATION_CREDENTIALS`: `FILE_PATH`
- credential reference present: `YES`
- referenced path: Render Secret Files convention
- secret file before remediation: absent
- credential resource runtime available before remediation: `NO`
- Firebase Admin initialization before remediation: `FAIL`
- Firebase Admin Auth call before remediation: `UNAVAILABLE`

The application had no startup validation for this optional capability. The
delete path swallowed the runtime error and returned 204.

## Chosen strategy

A project-scoped Firebase Admin service-account credential is mounted as a
Render Secret File named `firebase-sa.json`. The existing ADC file-path
architecture is retained. Credential material was never printed, committed,
or written to the audit package.

Post-remediation classification:

- credential mode: `FILE_PATH`
- reference present: `YES`
- runtime resource configured: `YES`
- Firebase Admin production runtime: `PROVEN` by canonical deletion E2E
