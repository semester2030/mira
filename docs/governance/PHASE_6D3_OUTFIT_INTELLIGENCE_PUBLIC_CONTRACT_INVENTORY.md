# Outfit Intelligence v1.0.0 — Public Contract Inventory

**Status:** Frozen  
**Date:** 2026-07-19

## 1. CanonicalOutfit

| Item | Contract |
|------|----------|
| Type | `CanonicalOutfit` (`canonical-outfit.ts`) |
| Schema pin | `outfit-schema-v1` |
| Public projection | `toPublicCanonicalOutfit` — strips `evidenceGraphRef` |
| Identity | Deterministic `outfitId` (`outfit-identity` / `outf_*`) |
| Required fields | `outfitId`, `version`, `garmentIds`, `slots`, `metrics`, `confidence`, `fieldConfidence`, `limitations`, `explainability`, `context`, `runtime`, `evaluationVersion`, `mappingVersion`, `createdAt`, `updatedAt` |

**Rule:** CanonicalOutfit is the **only** public outfit model for Outfit Intelligence. No parallel public DTOs. No provider outfit models.

## 2. Capabilities (catalog)

| Capability ID | Execution | Notes |
|---------------|-----------|-------|
| `analyze_outfit` | Enabled | Full pipeline → CanonicalOutfit |
| `compatibility` | Enabled | Partial; validated evidence graph |
| `color_harmony` | Enabled | Partial; validated evidence graph |
| `occasion_matching` | Enabled | Partial; validated evidence graph |
| `season_matching` | Enabled | Partial; validated evidence graph |
| `compare_looks` | Enabled | Two CanonicalOutfits + winner |
| `recommendations` | **Disabled** | Not part of Outfit Intelligence |

Catalog version: `fashion-cap-catalog-v1`.

## 3. Runtime

| Item | Contract |
|------|----------|
| Type | `CanonicalFashionRuntime` |
| Version | `fashion-runtime-v1` |
| Public helper | `toPublicFashionRuntime` |
| Stripped | `providerId` |
| Retained | `traceId` (intentional correlation; see Runtime Report) |
| Outfit reason codes | `outfit_evaluation_complete` · `outfit_evaluation_partial` · `outfit_evaluation_degraded` · `outfit_evaluation_failed_empty` |
| Stages used | `mapping` · `terminal` |

## 4. Validation

| Entry | Scope |
|-------|-------|
| `validateCanonicalOutfit` / `assertValidOutfit` | Full CanonicalOutfit + Law #31 citation |
| `validateEvidenceGraphIntegrity` / `assertValidEvidenceGraph` | Capability-only graphs |
| `assertNoFashionProviderLeakage` | Public DTOs |

## 5. Evidence Projection

| Surface | Public? |
|---------|---------|
| Outfit Evidence Graph (records + edges) | **Internal only** |
| `evidenceGraphRef` on CanonicalOutfit | Stripped from public projection |
| Metrics `evidenceIds` | Public (citations, not graph body) |
| Explainability `evidenceRefs` | Public (citations) |
| Field confidence `evidenceIds` | Public (citations) |

## 6. Public APIs (service surface)

| API | Returns |
|-----|---------|
| `OutfitIntelligenceService.analyzeOutfit` | Public CanonicalOutfit + internal evidenceGraph |
| `evaluateCompatibility` | Engine result + evidenceGraph |
| `evaluateColorHarmony` | Engine result + evidenceGraph |
| `evaluateOccasion` | Engine result + evidenceGraph |
| `evaluateSeason` | Engine result + evidenceGraph |
| `compareLooks` | Public CanonicalOutfit a/b + winner |

**Out of freeze scope:** Legacy HTTP `outfit-analysis` / hybrid routes outside `fashion-intelligence/outfit/**`.
