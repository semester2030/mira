# Styling Intelligence v1.0.0 — Public Contract Inventory

**Status:** Frozen  
**Date:** 2026-07-19

## 1. Canonical Styling Profile

| Item | Contract |
|------|----------|
| Type | `CanonicalStylingProfile` |
| Schema pin | `style-schema-v1` |
| Public projection | `toPublicCanonicalStylingProfile` — strips `decisionLedgerRef` |
| Identity | Deterministic `styleProfileId` (`style_*`) |
| Sections | Identity, preferences, goals, progress, history, evidenceIds, decisions, limitations, confidence, fieldConfidence, runtime, versions |

**Rule:** Canonical Styling Profile is the **only** public styling model. No parallel public schemas. No provider styling models.

## 2. Styling Runtime

| Item | Contract |
|------|----------|
| Type | `CanonicalFashionRuntime` |
| Version | `fashion-runtime-v1` |
| Public helper | `toPublicFashionRuntime` |
| Stripped | `providerId` |
| Retained | `traceId` (deterministic correlation) |
| Styling reason codes | `styling_evaluation_complete` · `styling_evaluation_partial` · `styling_evaluation_degraded` · `styling_evaluation_failed` |
| Stages | `mapping` · `terminal` |

## 3. Capabilities

| Capability ID | Execution | Notes |
|---------------|-----------|-------|
| `analyze_style` | Enabled | Full profile + internal ledger |
| `style_reason` | Enabled | Decisions + limitations |
| `style_goals` | Enabled | Goals + progress |
| `recommendations` | **Disabled** | Recommendation Engine phase — not Styling |

## 4. Validation

| Entry | Scope |
|-------|-------|
| `validateCanonicalStylingProfile` | Structural + consistency |
| `assertValidStylingProfileLaw32` | Law #32 frozen evidence (production path) |
| `assertNoFashionProviderLeakage` | Public DTOs |

## 5. Decision Projection

| Surface | Public? |
|---------|---------|
| Style Decisions (with evidenceRefs) | Yes — on profile |
| Decision Ledger body | **Internal only** |
| `decisionLedgerRef` | Stripped from public profile |
| Interpreted evidence graph | Internal |

## 6. Public APIs (service)

| API | Returns |
|-----|---------|
| `analyzeStyle` | Public profile + internal ledger + caller `memorySnapshot` |
| `reasonStyle` | Decisions + limitations (+ internal ledger) |
| `evaluateGoals` | Goals + progress (+ internal ledger) |
