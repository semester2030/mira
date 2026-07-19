# ADR-GI-003 — Provider independence at public boundaries

**Status:** Accepted · Frozen in v1.0.0  
**Date:** 2026-07-19

## Context

Geometry/semantics may come from FASHN, OpenAI, or future providers.

## Decision

Providers never appear as public garment models or success-path vendor metadata. Capability `analyze_garment` is Mira mapping (`providerRequirements: none`). Provider swap happens behind Vision adapters.

## Consequences

- Leakage asserts guard Canonical DTOs.  
- HTTP success meta omits vendor provider strings.
