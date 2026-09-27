# Firebase Auth Runtime Acceptance

Two temporary email/password technical identities were created through the
normal Firebase Auth REST flow. Tokens and passwords were held only in memory.

Observed:

- missing token: 401
- malformed token: 401
- valid identity A: protected entitlement endpoint 200
- valid identity B: protected entitlement endpoint 200
- Firebase project: expected production project
- response token/secret leakage: none
- identities created: 2
- identities deleted through Firebase Auth: 2

A third temporary identity used for malformed-request security checks was also
deleted. No customer identity or profile was accessed.

An isolated Admin-SDK job could not use the configured credential path because
`/etc/secrets/firebase-sa.json` was absent. Token verification nevertheless
worked through the deployed guard; privileged Admin operations did not.

`FIREBASE_AUTH_PRODUCTION_RUNTIME = PROVEN`
