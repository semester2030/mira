# ADR-OI-001 — CanonicalOutfit is the sole public outfit model

**Status:** Accepted · Frozen in Outfit Intelligence v1.0.0  
**Date:** 2026-07-19

## Context

Outfit composition must not leak provider models or parallel DTOs into public surfaces.

## Decision

`CanonicalOutfit` (`outfit-schema-v1`) is the only public outfit model produced by Outfit Intelligence. Evidence Graph bodies are internal. `toPublicCanonicalOutfit` strips `evidenceGraphRef`.

## Consequences

- Styling / Reco / clients consume CanonicalOutfit only.  
- Parallel public outfit schemas require MAJOR + CR.
