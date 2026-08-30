# Phase 3B — Commit Plan

## Proposed single atomic commit

Suggested message:

`fix: fail closed on provider and runtime safety gaps`

Include:

- strict Perfect Corp completeness validation and adversarial tests;
- production legacy Fashion disablement and canonical route guards;
- avatar client/rules canonical contract plus Flutter/emulator tests;
- bounded BlazeFace startup preload and health state;
- Redis critical fail-closed controls and tests;
- Phase 3B governance documents.

Exclude:

- `mira-api/scripts/lan-forward.py` (`LOCAL_ONLY`);
- generated `test/face_analysis_experience/failures/**`;
- unrelated Phase 2 Final/Phase 3 untracked evidence unless the owner explicitly
  elects to include those evidence sets;
- Desktop Technical Reference package/ZIP artifacts (outside repository).

## Pre-commit gate

Before owner approval, re-run source identity/status, `npm run test:phase3b`,
backend build/typecheck, avatar Flutter/emulator tests, scoped whitespace and
secret scans. Then stage only the approved manifest and inspect the exact staged
diff.

No commit, tag, push or deploy is authorized in this phase.

`AWAITING_OWNER_PHASE3B_COMMIT_APPROVAL`
