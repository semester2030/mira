# PHASE 9O — Freeze Regression Commands

Canonical list for changes affecting Face Experience:
```bash
flutter test test/face_analysis_experience/
flutter analyze lib/features/face_analysis_experience
cd mira-api && npm run test:phase9m-face-trust
cd mira-api && npx ts-node --transpile-only src/beauty-advisor/phase7b-beauty-advisor.schema-tests.ts
cd mira-api && npm run test:phase4f   # Face Intelligence validation when FI touched
```
Also run relevant shared Skin/report widget tests when result routing touched.
