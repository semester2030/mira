# Release-Gate Tests

## TEST evidence

All tests ran from the detached clean worktree after the production build.

PASS suites:

- Phase 0 production integrity (12 checks)
- Production entitlement and face-activation contracts
- Production Fashion activation contract
- Commerce/Firebase-auth security contract
- Provider ports (14 checks)
- Perfect Corp adversarial safety (14 classes)
- FASHN no-synthetic-success safety
- Redis critical fail-closed controls
- AT-2 strict LLM provider schema, parser, validator, and Claim Lock
- FK-3, FK-7, FK-8, FK-9, FK-10, FK-12
- Advisor/Laws #33/#34 and Fashion Laws #37/#38/#39

Results:

- `RELEASE_GATE_TESTS = PASS`
- `FROZEN_CONTRACT_REGRESSION = 0`
- Production provider fake-success count: `0`

Expected simulated failure logs were produced by adversarial tests only.
