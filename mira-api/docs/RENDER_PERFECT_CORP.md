# Render × Perfect Corp (YouCam) — Production Integration

## Architecture

```
Flutter App  →  Render (mira-api)  →  Perfect Corp YouCam API
                    ↓
              JSON result (no image stored)
```

- **Never** put `PERFECT_API_KEY` in Flutter, `.env` committed to the repo, or client-side code.
- Images are received in **memory** on the server, sent to YouCam via S2S file upload, then the buffer is zeroed (`skin-analysis.service.ts`).

## Render Dashboard

1. Open your **mira-api** web service → **Environment**.
2. Set:

| Variable | Value |
|----------|--------|
| `SKIN_PROVIDER` | `perfect_corp` |
| `PERFECT_API_KEY` | Your YouCam S2S API key |
| `PERFECT_BASE_URL` | `https://yce-api-01.makeupar.com/s2s/v2.0` (or URL from Perfect Corp console) |
| `PERFECT_CORP_FALLBACK_MOCK` | `false` (production — fail loud, no silent mock) |
| `API_PREFIX` | `api/v1` |
| `AUTH_SKIP` | `false` |
| `FIREBASE_PROJECT_ID` | Your Firebase project |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service account JSON path or secret |

Aliases `PERFECT_CORP_API_KEY` / `PERFECT_CORP_BASE_URL` also work.

3. **Save** → **Manual Deploy** (or push to trigger auto-deploy).

## API endpoints

Global prefix default: `api/v1`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/ai/skin-analysis` | Multipart field `image` → Perfect Corp |
| `POST` | `/api/v1/ai/outfit-analysis` | Multipart `image` + body `occasion` |
| `POST` | `/api/v1/ai/full-mira-analysis` | Skin + outfit + fusion + recommendation (multipart: `skinImage`, `outfitImage`, `occasion`) |
| `POST` | `/api/v1/skin-analysis` | Legacy alias (same handler) |
| `GET` | `/api/v1/health` | Health check |

**Auth:** `Authorization: Bearer <Firebase ID token>` (unless `AUTH_SKIP=true` locally).

## Postman test (before Flutter)

```http
POST https://<your-service>.onrender.com/api/v1/ai/skin-analysis
Authorization: Bearer <firebase-id-token>
Content-Type: multipart/form-data

image: <file>
```

## Flutter

```bash
flutter run \
  --dart-define=USE_MIRA_API=true \
  --dart-define=MIRA_API_BASE_URL=https://<your-service>.onrender.com/api/v1
```

Guest mode without login uses **local mock** only. After sign-in, analysis uses Render → Perfect Corp.

## Local dev

```bash
cd mira-api
cp .env.example .env
# Set PERFECT_API_KEY, SKIN_PROVIDER=perfect_corp
npm run start:dev
```

```bash
cd ..
flutter run --dart-define=USE_MIRA_API=true
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Mock results on Render | Set `SKIN_PROVIDER=perfect_corp` and `PERFECT_API_KEY` |
| 401 from API | User must be signed in; check Firebase token |
| YouCam file upload error | Confirm `PERFECT_BASE_URL` matches S2S v2.0 URL from console |
| Silent mock in prod | Set `PERFECT_CORP_FALLBACK_MOCK=false` |
