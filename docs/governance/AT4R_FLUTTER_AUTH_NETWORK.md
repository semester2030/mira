# AT-4R — Flutter QA / Device Networking / Auth

## Flutter dart-defines (actual names)
```bash
flutter run \
  --dart-define=MIRA_FASHION_ADVISOR_V1=true \
  --dart-define=MIRA_API_BASE_URL=http://127.0.0.1:3000/api/v1
```
Defaults (`mira_api_config.dart`):
- `USE_MIRA_API` default true
- `MIRA_API_BASE_URL` default **production** Render URL — must override for local QA

## Device → localhost

| Target | `MIRA_API_BASE_URL` |
|--------|---------------------|
| iOS Simulator | `http://127.0.0.1:3000/api/v1` |
| Android Emulator | `http://10.0.2.2:3000/api/v1` |
| Physical device | `http://<LAN_IP>:3000/api/v1` (Nest binds `0.0.0.0`) |

## Auth
- Production: Firebase Bearer via `ApiClient` interceptor
- Local QA: server `AUTH_SKIP=true` injects `dev-user` (`FirebaseAuthGuard`) — existing approved mechanism
- Flutter still prefers logged-in user (`AppSession.canUseCloud`); use a real Firebase-signed-in test account OR ensure guest gates don't block QA screen path
- Do **not** set `AUTH_SKIP=true` on Render production

## CORS
Local QA may use `WEBSITE_CORS_ORIGINS=*` in `.env.qa` only — not production blueprint.
