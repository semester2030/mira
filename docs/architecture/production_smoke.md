# Face Intelligence Production Smoke

## Command

```bash
cd mira-api
npm run smoke:face-intel
# Optional remote health:
FACE_SMOKE_BASE_URL=https://mira-api-n4p3.onrender.com/api/v1 npm run smoke:face-intel
```

## Expected outputs

1. Local `runFaceReportPipeline` returns `reportVersion: face-report-v1`  
2. Report JSON has no `rawYouCam`  
3. If `FACE_SMOKE_BASE_URL` set: `GET {base}/health` includes  
   `intelligence.faceIntelligence.reportVersion === face-report-v1`  
4. No API keys in health JSON  

## Manual device checklist (post-deploy)

1. Signed-in capture → analysis succeeds  
2. Response `miraReport.faceIntelligenceRuntime.status` is explicit  
3. If `AVAILABLE` / eligible → Flutter shows **ذكاء الملامح**  
4. If `FAILED` → Flutter shows runtime notice (not silent omit)  
5. No Perfect/YouCam raw payload in Face section  
