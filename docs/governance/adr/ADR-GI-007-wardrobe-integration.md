# ADR-GI-007 — Wardrobe stores garment references only

**Status:** Accepted · Frozen in v1.0.0  
**Date:** 2026-07-19

## Context

6B Wardrobe Foundation stores entity refs; GI produces CanonicalGarment for those refs.

## Decision

Wardrobe items reference `garmentId` (+ entityClass). They do not embed CanonicalGarment attribute snapshots as the source of truth. GI does not redefine wardrobe schemas.

## Consequences

- Identity stability is required for wardrobe history.  
- Outfit composition later references the same ids.
