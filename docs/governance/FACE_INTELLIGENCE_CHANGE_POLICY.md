# Face Intelligence Change Policy (v1.0.0 Freeze)

**Applies to:** all Face Intelligence code, contracts, goldens, Flutter production surfaces, and docs under governance.

**Status:** Binding from Face Intelligence **v1.0.0** freeze date 2026-07-19.

## 1. What may change without a Change Request

- Typos in non-contract documentation  
- Comments that do not alter behavior  
- Adding tests that assert existing frozen behavior  
- CI script wiring that does not change product outputs  

## 2. What may never change silently

- Geometry formula ids or numeric outcomes for the same inputs  
- Finding / recommendation / report schema field removals or renames  
- Attractiveness / beauty scoring as a Face Intel product claim  
- Merging Face Intelligence into FaceHealthMap  
- Silent omission of Face Intel runtime (must remain explicit states)  
- Dual production Face Report pipelines  

## 3. What requires a Change Request (CR)

Any of:

- Contract markdown or `FACE_CONTRACT_VERSION` / `FACE_VALIDATION_VERSION`  
- DTO field add/remove/rename/type change  
- Geometry / shape / reco formula id or logic  
- Golden / snapshot updates  
- Localization key semantics  
- Pipeline stage order or ownership  
- Provider coupling changes  
- Flutter production upload/runtime/UI contract changes  
- Release version bump  

Use: `docs/governance/FACE_INTELLIGENCE_CHANGE_REQUEST_TEMPLATE.md`

## 4. Contract evolution

1. Propose CR with before/after schema.  
2. Prefer **additive optional** fields (MINOR).  
3. Breaking changes → MAJOR + migration notes.  
4. Update `docs/contracts/face_*.md` and auditors in the same PR.  
5. Bump `FACE_CONTRACT_VERSION` only when contract semantics change.

## 5. DTO evolution

- Optional fields: MINOR; clients must tolerate absence.  
- Required fields: MAJOR.  
- Renames: MAJOR (prefer add + deprecate).  
- Never invent values for `unavailable` metrics.

## 6. Geometry formula evolution

- Same inputs must remain bit-stable unless MAJOR.  
- New formula id required for any intentional formula change.  
- Update goldens only with CR approval + golden update policy below.

## 7. Recommendation logic evolution

- Must retain evidence linkage (`assertFaceRecommendationEvidence`).  
- No Perfect product lock-in.  
- Educational-only paths remain allowed.

## 8. Version numbers

Follow SemVer in `FACE_INTELLIGENCE_VERSION_MANIFEST`:

| Change type | Bump |
|-------------|------|
| Breaking DTO/contract/formula | MAJOR |
| Additive optional capability | MINOR |
| Docs/tests/non-behavioral | PATCH |

Update both JSON manifest and markdown mirror.

## 9. Approval requirements

| Change class | Approvers |
|--------------|-----------|
| PATCH docs | Eng lead |
| MINOR additive | Eng lead + Face Intel owner |
| MAJOR / formula / golden rewrite | Eng lead + Product + Architecture review |

## 10. Regression requirements

Before merge, green:

- `npm run test:phase4a` … `test:phase4f`  
- `npm run test:phase4_5`  
- `npm run test:face-operational-e2e`  
- `npm run audit:face-eng-laws`  
- Flutter `test/phase4*_*.dart` / `phase4_5_*` as applicable  
- `npm run test:phase3.5` (skin sibling must not break)

## 11. Golden update policy

1. CR must explain why golden changes (formula intentional change vs bugfix).  
2. Diff every golden file in the PR.  
3. No silent overwrite in CI without review.  
4. Ineligible / unavailable goldens must remain invent-forbidden.

## 12. Snapshot policy

- Snapshot/golden equality is authoritative for regression.  
- Strip only documented non-deterministic fields (e.g. `generatedAt`).  
- Do not weaken assertions to “pass” a change.

## 13. Deprecation policy

1. Mark deprecated in docs + code comment with removal target version.  
2. Keep behavior for at least one MINOR cycle unless security risk.  
3. Flutter Face* mirrors: already gated; removal requires CR (offline roadmap).

## 14. Rollback policy

- Prefer revert PR of the CR.  
- Use `docs/phase4_operational_hardening_rollback.md` / `docs/phase4_5-rollback.md` patterns for integration-layer rollbacks.  
- Formula MAJOR rollback requires restoring prior formula id + goldens.

## 15. Freeze protection statement

Changing protected components (see `FACE_INTELLIGENCE_PROTECTED_COMPONENTS.md`) without an approved CR is a **governance violation**.
