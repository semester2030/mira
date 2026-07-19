# ADR-GI-006 — Runtime policy for Garment Intelligence

**Status:** Accepted · Frozen in v1.0.0  
**Date:** 2026-07-19

## Context

GI must emit Fashion Runtime without redesigning 6B runtime schemas; failures must not be silent.

## Decision

GI emits existing Fashion runtime statuses via `fashionRuntime` / `toPublicFashionRuntime`. Mapping/validation failures surface as explicit errors (`ProviderPortError`), never as successful empty `garments[]` when gate is `proceed`.

## Consequences

- Runtime schema ownership remains 6B.  
- Silent degradation is a freeze violation.
