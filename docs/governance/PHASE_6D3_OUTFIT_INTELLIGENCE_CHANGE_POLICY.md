# Outfit Intelligence v1.0.0 — Change Policy

**Applies to:** Frozen Outfit Intelligence v1.0.0  
**Authority:** Phase 6D.3 Production Freeze  

## SemVer Rules

| Version part | When |
|--------------|------|
| **MAJOR** (`2.0.0`) | Breaking public contract change (CanonicalOutfit fields/semantics, removed capabilities, public evidence graph requirement, runtime public shape break) |
| **MINOR** (`1.1.0`) | Backward-compatible additions (new optional metric name, new limitation code with texts, new capability behind flag default-off) |
| **PATCH** (`1.0.1`) | Bugfix with no contract change; documentation; test-only; release-label sync under Release Pin Policy |

Schema pin `outfit-schema-v1` stays until a **MAJOR** contract migration publishes `outfit-schema-v2`.

## Breaking Change Policy

Requires:

1. Written Change Request (CR)  
2. Architecture review  
3. Compatibility impact (Wardrobe, GI, future Styling)  
4. Migration plan + dual-read window if consumers exist  
5. Independent review for Law #31 / Evidence Graph changes  
6. Explicit approval before merge to production  

**Forbidden without MAJOR + CR:** redesign of pipeline order, Evidence Graph architecture, CanonicalOutfit sole-public rule, provider injection into Outfit.

## Minor Change Policy

Allowed under CR-lite / standard review when:

- Additive optional fields with defaults  
- New limitation codes mapped in Limitation Engine  
- Non-breaking validator strengthening  
- Documentation / ADR amendments  

Must keep:

- Evidence → Metrics → Confidence  
- Deterministic identity for same inputs  
- No provider leakage  

## Migration Rules

1. New schema pin (`outfit-schema-vN`) before removing old fields.  
2. Public strip rules preserved or explicitly versioned.  
3. Golden regression suite updated in same CR.  
4. Consumers migrate on schema pin, not release label.  

## Approval Workflow

```
Propose CR → Owner triage → Architecture check →
Law #31 / contract check → Implement on branch →
Regression (6B+6C+6D or successor) → Review → Merge →
Update Version Manifest + Compatibility Matrix
```

## Rollback Policy

1. Prefer revert of CR commit(s) over forward-fix for contract breaks.  
2. If schema already published, roll forward with `outfit-schema-vN` dual support — do not silently mutate v1.  
3. Freeze certificate remains valid for last good v1.0.x until MAJOR supersedes.  

## Out of policy (new subsystems)

Styling Intelligence, Recommendation Engine, FKG, Taxonomy are **new phases** — they consume frozen Outfit; they do not modify Outfit without CR.
