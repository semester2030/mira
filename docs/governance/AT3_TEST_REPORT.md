# AT-3 — Test / Regression / Analyze

## Tests
```
flutter test test/advisor/
```
**PASS** (19 tests) — routing, mapper, culture, preferences, API fashion POST, response decode.

## Analyze
```
flutter analyze lib/features/advisor lib/core/config/mira_features.dart
```
**No issues found**

## Backend regression
PASS: `test:at2`, `test:fk10`, `test:fk12`, `test:phase7b`
