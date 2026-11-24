# Celebrity avatar upload — Safari Lockdown Mode

## Root cause
`partners-portal/web/js/creator-profile.js` called `new FileReader()` to Base64-encode the avatar before `POST /partners-portal/creator-profile/avatar` (JSON). Safari Lockdown Mode removes `FileReader`, so registration failed with `Can't find variable: FileReader` after profile upsert could already succeed.

## Fix
- Browser: upload the selected `File` via `FormData` multipart (`PartnersApi.setCreatorAvatarFile`) — no FileReader / Base64.
- Preview: optional `URL.createObjectURL` only (does not block upload if unavailable).
- API: `POST /partners-portal/creator-profile/avatar` accepts multipart field `file` (preferred) and keeps JSON `dataBase64` fallback.
- UX: double-submit guard; if profile saves but avatar fails, Arabic message + form retains name/bio/public flag for retry; upsert remains partner-scoped (one profile).

## Files
- `partners-portal/web/js/creator-profile.js`
- `partners-portal/web/js/api.js`
- `mira-api/src/marketplace/creator-profile.controller.ts`
- `mira-api/src/marketplace/creator-profile.service.ts`
- `mira-api/src/marketplace/creator-ads.v1.http.integration-tests.ts`
- `partners-portal/web/js/creator-profile-lockdown.tests.mjs`

## Tests
| Test | Result |
|---|---|
| `node partners-portal/web/js/creator-profile-lockdown.tests.mjs` (FileReader deleted) | PASS |
| HTTP multipart avatar (integration suite) | added assertion |
| iPhone Safari Lockdown live | see delivery note after deploy |

