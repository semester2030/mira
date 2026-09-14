# AT-4R — Auth Readiness

## `/advisor/chat` auth
Uses `FirebaseAuthGuard`. Production requires Firebase Bearer.

## Local QA approved bypass
`AUTH_SKIP=true` (non-production) injects `dev-user` — already used in local `.env`.
AT-4R keeps this for Nest smoke; **never** enable on Render production.

## Flutter client
`ApiClient` attaches Firebase ID token when a signed-in session exists.
For realistic client QA: use a Firebase test account on Simulator.
With `AUTH_SKIP`, unsigned requests still accept at Nest — useful for Nest-side live tests.

## Firebase dependency for Fashion Advisor path
- Nest path needs auth guard satisfaction (Firebase **or** AUTH_SKIP locally).
- Fashion Knowledge LLM path itself does **not** require Firebase Admin credentials beyond auth.
- Do not introduce Firebase solely for AT-4 if AUTH_SKIP local path is used for Nest proof.
