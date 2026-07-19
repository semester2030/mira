# Styling Intelligence v1.0.0 — Change Policy

**Applies to:** Frozen Styling Intelligence v1.0.0  
**Authority:** Phase 6E.3 Production Freeze  

## SemVer Rules

| Version part | When |
|--------------|------|
| **MAJOR** (`2.0.0`) | Breaking public contract (CanonicalStylingProfile fields/semantics, Law #32 weaken, removed capabilities, public ledger requirement) |
| **MINOR** (`1.1.0`) | Backward-compatible additions (optional fields, new limitation codes, new capability default-off) |
| **PATCH** (`1.0.1`) | Bugfix without contract change; docs; test sync; release-label sync under Release Pin Policy |

Schema pin `style-schema-v1` remains until MAJOR publishes `style-schema-v2`.

## Breaking Change Policy

Requires written CR, architecture review, Law #32 impact review, compatibility impact (OI/GI/Wardrobe/Advisor), migration plan, regression (`test:phase6b`–`6e`), explicit approval.

**Forbidden without MAJOR + CR:** redesign of Decision Ledger, Reasoning Engine pipeline, Law #32 frozen-kind set, CanonicalStylingProfile sole-public rule, provider injection.

## Minor Change Policy

Additive optional fields, new limitation codes, non-breaking validator strengthening, documentation/ADR amendments — under standard review. Must preserve Law #32 and determinism.

## Migration Rules

1. New schema pin before removing fields.  
2. Public strip rules preserved or explicitly versioned.  
3. Golden Law #32 tests updated in same CR.  
4. Consumers bind to schema pins, not release labels.

## Approval Workflow

```
Propose CR → Owner triage → Architecture + Law #32 check →
Implement on branch → Regression 6B–6E → Review → Merge →
Update Version Manifest + Compatibility Matrix
```

## Rollback Policy

1. Prefer revert for contract breaks.  
2. If schema published, dual-read `style-schema-vN` — do not silently mutate v1.  
3. Freeze certificate remains valid for last good v1.0.x until MAJOR supersedes.
