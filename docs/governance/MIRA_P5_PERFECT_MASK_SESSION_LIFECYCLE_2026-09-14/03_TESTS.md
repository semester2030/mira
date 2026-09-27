# Tests

```
flutter test \
  test/results_experience/perfect_mask_session_lifecycle_test.dart \
  test/results_experience/perfect_mask_session_test.dart \
  test/results_experience/perfect_mask_face_explorer_polish_test.dart
→ All tests passed
```

Lifecycle coverage:
- owner set keeps bytes
- detach drops owner without wiping held bytes
- new analysis replaces previous (single owner)
- identical set is no-op
