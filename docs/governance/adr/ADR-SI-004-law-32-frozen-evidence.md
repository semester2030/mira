# ADR-SI-004 — Engineering Law #32 (Frozen Evidence)

**Status:** Accepted · Frozen in Styling Intelligence v1.0.0  
**Date:** 2026-07-19

## Context

Independent Audit failed when goal drafts / arbitrary fallbacks satisfied “evidence” without frozen subsystems.

## Decision

**Law #32:** Every styling decision must be explainable through frozen evidence.

Allowed frozen kinds only: Skin, Face, CanonicalGarment, CanonicalOutfit, Wardrobe references.

`goal_draft`, preference, and memory alone never qualify. Active goals require frozen cites. Missing frozen evidence → blocked goal / `missing_evidence` — never fabricate.

## Consequences

- `tryPushFrozen` + `assertValidStylingProfileLaw32` are protected.  
- Weakening frozen-kind set requires MAJOR + Independent review.
