# Phase 6C.1 — Garment Intelligence Remediation Report

**Release:** `0.2.1-garment-intelligence-remediation`  
**Mode:** Strict Remediation · Production fixes only  
**Baseline audit:** Independent Audit — Phase 6C (Not approved for Production Freeze)

## Executive Summary

All **3 Critical Findings** and production-correctness **Major Findings** from the Independent Audit are remediated. No new features. No architecture redesign. Outfit Intelligence not started.

## Critical Findings Resolution

| # | Finding | Fix |
|---|---------|-----|
| 1 | Nondeterministic `garmentId` | Content-addressed `deterministicGarmentId` (sha256). Policy: `docs/governance/GARMENT_IDENTITY_POLICY.md`. Epoch timestamps for pure mapping. |
| 2 | CanonicalGarment not sole public model | `FashionAnalysisPortResult.garments: CanonicalGarment[]`. `fashionVision` removed from port + HTTP. `DetectedGarment` marked `@internal`. |
| 3 | Adapter silent swallow | Mapping/validation errors throw `ProviderPortError`. Empty garments on `proceed` rejected. No empty success path. |

## Major Findings Resolution

| Finding | Fix |
|---------|-----|
| geometryRef unused | Mapped from `geometry.segments` via regionRole + index |
| fusion.fieldConfidence unused | Merged in `ConfidenceEngine.aggregate` |
| Alias duplication | Shared SSOT `vision/schema/fashion-aliases.ts` |
| Hardcoded catalog category allowlist | `catalogOwnedCategoryIds()` from catalog index |
| Provider leakage on meta / ban list | Opaque `provider: 'mira'`; expanded leakage ban; HTTP meta omits provider strings |
| Index-only pairing | Type+category match first, residual by order |
| Catalog ambiguity attaches seasons | Ambiguous → no `catalogPieceId`; no season/occasion attach |
| Fragile color match | Stem-normalized color compatibility |
| Weak tests | Determinism, geometry, fusion fields, multi-garment, ambiguity, adapter failure, leakage, golden pin |

## Intentionally not redesigned (Major residual)

| Item | Status |
|------|--------|
| Ports ↔ GI ↔ Vision ontology coupling | Residual debt — fixing would be architecture redesign (out of scope) |
| Transition validator on fresh emit | Acceptable for new objects |
| Catalog JSON re-read for season attrs | Minor perf; not required for correctness |

## Before vs After

| Surface | Before | After |
|---------|--------|-------|
| `garmentId` | `newTraceId` (Date.now + random) | `garm_<sha256…>` stable |
| Port garments | `DetectedGarment[]` | `CanonicalGarment[]` |
| Port `fashionVision` | Returned to Flutter | Internal only |
| Mapping failure | `garments=[]` silent | `ProviderPortError` |
| `geometryRef` | Always undefined | Segment id + regionRole |
| Catalog ambiguous | Picked first id + seasons | Limitation only |

## Validation

- `npm run test:phase6c` — PASS (incl. 6C.1 cases)
- `npm run test:phase6b` — PASS (release pin updated)

## Remaining Risks

1. Flutter client still expects `fashionVision` on `/ai/vision/outfit/analyze` — contract break until client remaps to CanonicalGarment (Outfit/client phase, out of scope).
2. Residual Ports↔GI↔Vision package coupling.
3. Attribute field confidence constants remain when fusion lacks a matching field (fusion fields preferred when present).

## Technical Debt

1. Bidirectional adapter ↔ GI import (pre-existing; not redesigned).
2. Per-piece catalog file read for season/occasion evidence.
3. Flutter / Outfit path not updated in this remediation (explicitly out of scope).

## Final Recommendation

Ready for **Independent Re-Audit**.  
**Do not Production Freeze** until Re-Audit passes.
