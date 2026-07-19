# ADR-OI-006 — Deterministic Outfit Identity

**Status:** Accepted · Frozen in Outfit Intelligence v1.0.0  
**Date:** 2026-07-19

## Context

Same wardrobe look must yield stable identity for caching, audit, and compare_looks.

## Decision

`outfitId` is deterministic from sorted garmentIds + context fields (occasion, climate, season, modesty). Evaluation uses sorted garment input. Evidence IDs are content-stable hashes. Graph build sorts records/edges. Mapping timestamps use fixed epoch for determinism in evaluation artifacts.

## Consequences

- Non-deterministic identity is a defect.  
- Changing identity algorithm requires MAJOR (breaks existing `outf_*` consumers) or dual identity versioning via CR.
