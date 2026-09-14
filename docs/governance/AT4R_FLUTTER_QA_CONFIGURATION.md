# AT-4R — Flutter QA Configuration

## Actual dart-define names (repo evidence)
- `MIRA_FASHION_ADVISOR_V1` → `MiraFeatures.fashionAdvisorV1` (default **false**)
- `MIRA_API_BASE_URL` → overrides default production Render URL
- `USE_MIRA_API` (default true)

## Recommended local simulator command
```bash
flutter run \
  --dart-define=MIRA_FASHION_ADVISOR_V1=true \
  --dart-define=MIRA_API_BASE_URL=http://127.0.0.1:3000/api/v1
```

## Rollback
Omit `MIRA_FASHION_ADVISOR_V1` or set `false` → fashionUnavailable path (no MCE prescription).
