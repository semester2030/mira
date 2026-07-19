# AI Beauty Advisor v1.0.0 — Change Policy

**Applies to:** Frozen AI Beauty Advisor v1.0.0  
**Authority:** Phase 7B.2 Production Freeze  

## SemVer Rules

| Version part | When |
|--------------|------|
| **MAJOR** (`2.0.0`) | Breaking public contracts; Law #33/#34 weaken; envelope speech bypass; removing capabilities |
| **MINOR** (`1.1.0`) | Backward-compatible additions (optional fields, new intents default-safe, new limitation codes) |
| **PATCH** (`1.0.1`) | Bug fixes without contract change; docs; test sync; release-label sync |

Envelope pin `advisor-envelope-v1` remains until MAJOR publishes `advisor-envelope-v2`.

## Breaking Change Policy

Requires written CR, architecture review, Law #33/#34 impact, compatibility impact (frozen peers), migration plan, regression (`test:phase6b`–`6e`, `test:phase7b`), explicit approval.

**Forbidden without MAJOR + CR:** redesign of Envelope / Planner / Router / grounded speech rules; inventing frozen subsystem ownership; enabling shopping/reco inside Advisor.

## Minor Change Policy

Additive optional fields, stronger validators, documentation/ADR amendments under standard review. Must preserve Law #33/#34 and determinism.

## Migration Rules

1. New envelope/runtime pin before removing fields.  
2. Public HTTP DTO strip rules preserved or explicitly versioned.  
3. Golden Law #34 / stale / provenance tests updated in same CR.  
4. Consumers bind to version pins, not informal labels.

## Approval Workflow

```
Propose CR → Owner triage → Law #33/#34 check →
Implement on branch → Regression 6B–6E + 7B → Review → Merge →
Update Version Manifest + Compatibility Matrix
```

## Rollback Policy

1. Prefer revert for contract breaks.  
2. If envelope schema published, dual-read — do not silently mutate v1.  
3. Freeze certificate remains valid for last good v1.0.x until MAJOR supersedes.
