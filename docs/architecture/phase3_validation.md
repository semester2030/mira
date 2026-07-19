# Phase 3 Validation Architecture

**Phase:** 3.5 — Skin Intelligence Validation & Contracts  
**Contract:** `skin-intel-contract-v1`

## Goal

Prove internal consistency of:

Provider → Canonical → Findings → SVI v2 → Recommendations → Progress → Report → Localization → Public DTO → Flutter

Without adding end-user features.

## Artifacts

| Artifact | Path |
|----------|------|
| Master contract | `docs/contracts/skin_intelligence_contract.md` |
| Report contract | `docs/contracts/skin_report_contract.md` |
| SVI contract | `docs/contracts/svi_contract.md` |
| Recommendation contract | `docs/contracts/recommendation_contract.md` |
| Progress contract | `docs/contracts/progress_contract.md` |
| Auditors | `mira-api/src/intelligence/skin-intelligence/validation/contract-audit.ts` |
| Fixtures | `.../validation/fixtures.ts` |
| Goldens | `.../validation/goldens/*.golden.json` |
| Suite | `npm run test:phase3.5` |

## Architecture review (Phase 3.5)

| Topic | Finding | Action |
|-------|---------|--------|
| Finding `reason` field | Bound to `evidenceAr/En` in contract | Documented; no silent alias repair |
| Finding `version` | Bound to `finding-v1` + report `intelligenceVersion` | Documented |
| Educational recommendations | Allowed without finding links | Explicit contract carve-out |
| `computeBeautyScore` (svi-v1 util) | Still present for legacy tests | Not used for new analyses; SVI v2 is authoritative |
| Provider leakage | Engines free of Perfect/YouCam imports | Static check in Phase 3.5 suite |
| Flutter theme | Skin Intelligence UI uses Premium/AppColors | Out of scope for 3.5 (no UI redesign) |
| Dead DTOs | None found in skin-intelligence package | — |
| Documentation drift | Phase 3 architecture docs remain valid; contracts supersede for validation | Keep both |

## Failure policy

Contract auditors **throw**. Never invent missing metrics, translations, or evidence.
