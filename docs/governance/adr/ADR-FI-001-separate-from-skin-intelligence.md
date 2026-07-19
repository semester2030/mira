# ADR-FI-001 — Face Intelligence separate from Skin Intelligence

**Status:** Accepted · Frozen in v1.0.0  
**Date:** 2026-07-19

## Context

Mira already has Skin Intelligence (SVI, concerns, routines) driven largely by skin providers.

## Decision

Face Intelligence is a **sibling domain**: geometry, shape, styling recommendations — not skin vitality.

## Consequences

- Separate packages, versions, contracts, and report field (`faceIntelligence`).  
- Must not overload Skin DTOs or FaceHealthMap.
