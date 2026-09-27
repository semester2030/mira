# Phase 3C — Provider Failure Acceptance

No paid failures were deliberately generated. Phase 3B local doubles and safe
edge/guard rejections were rerun.

| Dependency | Missing credential | 401/403 | 429 | 500 | Timeout | Malformed | Partial | Failure becomes success |
|---|---|---|---|---|---|---|---|---|
| Perfect Corp | PASS | PASS | PASS | PASS | PASS | PASS | PASS | NO |
| FASHN canonical/legacy | PASS | PASS | PASS | PASS | PASS | PASS | PASS | NO |
| OpenAI/Fashion safety | PASS | PASS | PASS | PASS | PASS | PASS | PASS | NO |
| Redis critical control | PASS | NOT_REQUIRED | PASS | PASS | PASS | PASS | PASS | NO |
| BlazeFace | NOT_REQUIRED | NOT_REQUIRED | NOT_REQUIRED | PASS | PASS | PASS | PASS | NO |
| Firebase guard/rules | PASS | PASS | NOT_TESTED | PARTIAL | PARTIAL | PASS | PASS | NO |

Additional evidence:

- real TFHub preload failure stopped startup and returned no face result;
- unauthenticated provider edges returned rejection only;
- live Firebase guard rejected missing and invalid tokens;
- Avatar emulator denied unauthorized, wrong-path, invalid-type and oversized
  writes;
- Redis critical counter failure maps to 503 while optional FAQ cache remains
  explicitly best-effort.

## Invariant

`PROVIDER FAILURE != SUCCESSFUL AI RESULT`

`PASS`
