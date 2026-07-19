# Garment Intelligence — Change Policy v1.0.0

**Applies to:** Garment Intelligence frozen release `1.0.0`  
**CR template:** `docs/governance/GARMENT_INTELLIGENCE_CHANGE_REQUEST_TEMPLATE.md`  
**CR filing:** `docs/governance/crs/` (prefix `GI-`)

## 1. Principle

Frozen means **no silent edits**. All behavioral or contract changes require a Change Request (CR), review, version bump, and regression proof.

## 2. Allowed without CR (governance-only)

- Documentation corrections that do not alter contract meaning  
- Adding tests that assert existing frozen behavior  
- Portal / index links  

## 3. Non-breaking changes (MINOR — CR required)

- Additive optional fields on `CanonicalGarment` with safe absence semantics  
- New limitation / explainability codes that clients may ignore  
- Additional golden fixtures for existing behavior  
- Performance improvements that do not change outputs for identical Vision evidence  

## 4. Breaking changes (MAJOR — CR + program approval)

- Removing / renaming public fields  
- Changing `garmentId` identity formula or policy version semantics  
- Returning `FashionVisionDocument` / `DetectedGarment` / provider payloads on public analyze success  
- Silent empty `garments[]` on mapping failure  
- Changing `analyze_garment` to call providers directly  
- Incompatible Wardrobe ref semantics  

## 5. Forbidden without explicit program exception

- Redesigning Wardrobe / Session / Runtime schemas “for GI convenience”  
- Embedding Knowledge Graph / Taxonomy Service ownership inside GI engines  
- Starting Outfit / Styling work inside the GI package  
- Weakening leakage asserts to allow vendor strings on public DTOs  

## 6. Deprecation policy

1. Announce in CR + governance note with target removal version.  
2. Keep field/behavior through at least one MINOR.  
3. Remove only on MAJOR with migration notes.  

## 7. Migration rules

- Client migrations (e.g. Flutter CanonicalGarment adoption) tracked as TD + CR if server must temporarily dual-serve (dual-serve itself is MAJOR and discouraged).  
- Preferred: single Canonical public contract; clients migrate.  

## 8. Version bump policy

| Change type | Bump |
|-------------|------|
| Docs / tests only | PATCH `1.0.x` |
| Additive safe contract | MINOR `1.x.0` |
| Breaking contract / identity / public path | MAJOR `x.0.0` |

Update: Version Manifest JSON + MD, Freeze Certificate addendum, Protected Components if scope expands.

## 9. Approval process

1. Author files CR (`GI-YYYYMMDD-short-title.md`) from template.  
2. Engineering review: architecture laws, leakage, determinism, 6B/6C tests.  
3. Program owner approval for MAJOR.  
4. Merge only after CI / `npm run test:phase6c` (+ `test:phase6b` if needed).  
5. Update Technical Debt Register if debt introduced or retired.

## 10. Rollback

Failed production change: revert to last frozen tag / known-good build of `1.0.0` (build id `0.2.1-garment-intelligence-remediation`) unless a later approved freeze supersedes it.
