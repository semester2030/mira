# Tests

```
npx tsx mira-api/src/skin-analysis/skin-analysis-response-ephemeral-masks.schema-tests.ts
→ PASS omit missing / include present / omit empty

flutter test test/results_experience/perfect_mask_create_proof_test.dart \
             test/results_experience/perfect_mask_session_lifecycle_test.dart
→ All passed

npm run build (mira-api)
→ nest build OK
```

Physical SESSION_READY requires **deployed** API with ephemeralMasks on `/ai/skin-analysis`.
