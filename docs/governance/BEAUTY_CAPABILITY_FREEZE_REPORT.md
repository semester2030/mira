# Beauty Capability Freeze

**Catalog version:** 1.0.0  
**Date:** 2026-07-19  
**Phase:** 5A.5  
**Portal:** `docs/mira-production-transformation-program.html#phase5a5-report`

## 1 Executive Summary

The Beauty Capability architecture is frozen as a governed catalog. IDs are permanent, metadata is the single source of truth, dependencies are explicit, and runtime states are explainable. No provider SDKs or try-on were implemented.

## 2 Capability Catalog

SSOT: `mira-api/src/beauty-experience/capability/BEAUTY_CAPABILITY_CATALOG.json`  
Docs: `docs/governance/BEAUTY_CAPABILITY_CATALOG.md`

## 3 Capability IDs

Frozen: `lip`, `foundation`, `blush`, `eyeshadow`, `contour`, `hair_color`, `hair_style`, `glasses` (display: Eyewear), `look`, `makeup_vto` (deprecated). Renaming forbidden.

## 4 Version Policy

`beauty-cap-semver-v1` — MAJOR / MINOR / PATCH · deprecate · remove. See `BEAUTY_CAPABILITY_VERSION_POLICY.md`.

## 5 Dependency Graph

Explicit edges via catalog `dependencies` + `buildCapabilityDependencyGraph()`. Example: hair_color → hair_mask → face_alignment → capture_quality → capability_policy.

## 6 Runtime Matrix

NOT_REQUESTED · AVAILABLE · UNAVAILABLE · FAILED · SKIPPED · BLOCKED_BY_POLICY · BLOCKED_BY_LICENSE · BLOCKED_BY_COST · BLOCKED_BY_PLATFORM · BLOCKED_BY_PROVIDER · BLOCKED_BY_ASSETS · BLOCKED_BY_QUALITY — with reason, stage, policy, version (provider audit server-only).

## 7 Cost Classes

LOW · MEDIUM · HIGH · VERY_HIGH

## 8 Compatibility Matrix

Rules for parallel / sequential / mutually exclusive (e.g. `makeup_vto` ⊥ `lip`).

## 9 Provider Support Matrix

Separate from capabilities; priority matrix unchanged in intent; stubs remain unlicensed.

## 10 Contracts

Catalog · Metadata · Dependency · Compatibility · Runtime · Version · Cost — `BEAUTY_CAPABILITY_CONTRACTS.md`.

## 11 Validation

`npm run test:phase5a5` PASS · `test:phase5a` PASS · `audit:beauty-eng-laws` PASS

## 12 Remaining Risks

Callers may still use deprecated `makeup_vto`. Display “Eyewear” must not spawn an `eyewear` id.

## 13 Freeze Status

**FROZEN.** Future capabilities require formal Change Requests.

Beauty Capability Catalog v1.0.0 has been frozen.

Future capabilities require formal Change Requests.

Phase 5B may begin.
